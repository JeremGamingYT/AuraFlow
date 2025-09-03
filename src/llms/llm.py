# Copyright (c) 2025 Bytedance Ltd. and/or its affiliates
# SPDX-License-Identifier: MIT

import os
from pathlib import Path
from typing import Any, Dict, get_args

import httpx
from langchain_core.language_models import BaseChatModel
from langchain_deepseek import ChatDeepSeek
from langchain_openai import AzureChatOpenAI, ChatOpenAI

from src.config import load_yaml_config
from src.config.agents import LLMType
from src.llms.providers.dashscope import ChatDashscope

# Cache for LLM instances
_llm_cache: dict[LLMType, BaseChatModel] = {}


def _get_config_file_path() -> str:
    """Get the path to the configuration file."""
    return str((Path(__file__).parent.parent.parent / "conf.yaml").resolve())


def _get_llm_type_config_keys() -> dict[str, str]:
    """Get mapping of LLM types to their configuration keys."""
    return {
        "reasoning": "REASONING_MODEL",
        "basic": "BASIC_MODEL",
        "vision": "VISION_MODEL",
        "code": "CODE_MODEL",
    }


def _get_env_llm_conf(llm_type: str) -> Dict[str, Any]:
    """
    Get LLM configuration from environment variables.
    Environment variables should follow the format: {LLM_TYPE}__{KEY}
    e.g., BASIC_MODEL__api_key, BASIC_MODEL__base_url
    """
    prefix = f"{llm_type.upper()}_MODEL__"
    conf = {}
    for key, value in os.environ.items():
        if key.startswith(prefix):
            conf_key = key[len(prefix) :].lower()
            conf[conf_key] = value
    return conf


# ---------------------------------------------------------------------------
# LM Studio support helpers
# ---------------------------------------------------------------------------


def _detect_lmstudio_base_url() -> str | None:
    """Detect a running LM Studio instance.

    LM Studio exposes an OpenAI-compatible HTTP API typically at
    http://localhost:1234 or (for remote access) at http://<LAN-IP>:1234.

    We attempt to contact a list of common endpoints and return the first one
    that responds successfully to the `/v1/models` route.
    Returns the base URL including the trailing `/v1` path (e.g.
    "http://localhost:1234/v1") or ``None`` if not detected.
    """

    candidate_hosts = [
        "http://localhost:1234",
        "http://127.0.0.1:1234",
        "http://192.168.2.65:1234",
    ]

    # Optionally allow users to specify LAN host through env var
    lan_host = os.getenv("LMSTUDIO_LAN_HOST")  # e.g. 192.168.2.65
    if lan_host:
        candidate_hosts.insert(0, f"http://{lan_host}:1234")

    for host in candidate_hosts:
        try:
            # A very small timeout to keep startup fast
            res = httpx.get(f"{host}/v1/models", timeout=1.0)
            if res.status_code == 200:
                return f"{host}/v1"
        except Exception:
            # Any connection error -> try next host
            continue
    return None


def _create_llm_use_conf(llm_type: LLMType, conf: Dict[str, Any]) -> BaseChatModel:
    """Create LLM instance using configuration."""
    llm_type_config_keys = _get_llm_type_config_keys()
    config_key = llm_type_config_keys.get(llm_type)

    if not config_key:
        raise ValueError(f"Unknown LLM type: {llm_type}")

    llm_conf = conf.get(config_key, {})
    if not isinstance(llm_conf, dict):
        raise ValueError(f"Invalid LLM configuration for {llm_type}: {llm_conf}")

    # Get configuration from environment variables
    env_conf = _get_env_llm_conf(llm_type)

    # Merge configurations, with environment variables taking precedence
    merged_conf = {**llm_conf, **env_conf}

    if not merged_conf:
        # Attempt implicit LM Studio detection if no explicit configuration is found
        lmstudio_base = _detect_lmstudio_base_url()
        if lmstudio_base:
            merged_conf = {
                "api_base": lmstudio_base,
                "api_key": "lm-studio",  # placeholder
                "streaming": True,
            }
        else:
            raise ValueError(
                f"No configuration found for LLM type: {llm_type} and LM Studio not detected"
            )

    # Add max_retries to handle rate limit errors
    if "max_retries" not in merged_conf:
        merged_conf["max_retries"] = 3

    # Handle SSL verification settings
    verify_ssl = merged_conf.pop("verify_ssl", True)

    # Create custom HTTP client if SSL verification is disabled
    if not verify_ssl:
        http_client = httpx.Client(verify=False)
        http_async_client = httpx.AsyncClient(verify=False)
        merged_conf["http_client"] = http_client
        merged_conf["http_async_client"] = http_async_client

    if "azure_endpoint" in merged_conf or os.getenv("AZURE_OPENAI_ENDPOINT"):
        return AzureChatOpenAI(**merged_conf)

    # Check if base_url is dashscope endpoint
    if "base_url" in merged_conf and "dashscope." in merged_conf["base_url"]:
        if llm_type == "reasoning":
            merged_conf["extra_body"] = {"enable_thinking": True}
        else:
            merged_conf["extra_body"] = {"enable_thinking": False}
        return ChatDashscope(**merged_conf)

    if llm_type == "reasoning":
        merged_conf["api_base"] = merged_conf.pop("base_url", None)
        return ChatDeepSeek(**merged_conf)
    else:
        # -------------------------------------------------------------------
        # Fallback: attempt to use a locally running LM Studio server
        # -------------------------------------------------------------------

        lmstudio_base = merged_conf.get("base_url") or _detect_lmstudio_base_url()

        if lmstudio_base:
            # LM Studio uses OpenAI-compatible API, so ChatOpenAI works.
            merged_conf["api_base"] = lmstudio_base
            # LM Studio ignores the API key but langchain-openai requires one.
            merged_conf.setdefault("api_key", "lm-studio")
            # Enable streaming by default if not specified
            merged_conf.setdefault("streaming", True)
        return ChatOpenAI(**merged_conf)


def get_llm_by_type(llm_type: LLMType) -> BaseChatModel:
    """
    Get LLM instance by type. Returns cached instance if available.
    """
    if llm_type in _llm_cache:
        return _llm_cache[llm_type]

    conf = load_yaml_config(_get_config_file_path())
    llm = _create_llm_use_conf(llm_type, conf)
    _llm_cache[llm_type] = llm
    return llm


def get_configured_llm_models() -> dict[str, list[str]]:
    """
    Get all configured LLM models grouped by type.

    Returns:
        Dictionary mapping LLM type to list of configured model names.
    """
    try:
        conf = load_yaml_config(_get_config_file_path())
        llm_type_config_keys = _get_llm_type_config_keys()

        configured_models: dict[str, list[str]] = {}

        for llm_type in get_args(LLMType):
            # Get configuration from YAML file
            config_key = llm_type_config_keys.get(llm_type, "")
            yaml_conf = conf.get(config_key, {}) if config_key else {}

            # Get configuration from environment variables
            env_conf = _get_env_llm_conf(llm_type)

            # Merge configurations, with environment variables taking precedence
            merged_conf = {**yaml_conf, **env_conf}

            # Check if model is configured
            model_name = merged_conf.get("model")
            if model_name:
                configured_models.setdefault(llm_type, []).append(model_name)

        return configured_models

    except Exception as e:
        # Log error and return empty dict to avoid breaking the application
        print(f"Warning: Failed to load LLM configuration: {e}")
        return {}


# In the future, we will use reasoning_llm and vl_llm for different purposes
# reasoning_llm = get_llm_by_type("reasoning")
# vl_llm = get_llm_by_type("vision")

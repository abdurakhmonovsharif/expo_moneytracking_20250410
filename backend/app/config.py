from functools import lru_cache
import json
from typing import List, Dict, Any
from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    # Single Web OAuth Client ID — the same ID is used on iOS/Android/web.
    google_web_client_id: str = Field(..., env="GOOGLE_WEB_CLIENT_ID")

    firebase_project_id: str = Field(..., env="FIREBASE_PROJECT_ID")
    firebase_service_account_path: str = Field(..., env="FIREBASE_SERVICE_ACCOUNT_PATH")
    firebase_uid_prefix: str = Field("google:", env="FIREBASE_UID_PREFIX")
    firebase_apple_uid_prefix: str = Field("apple:", env="FIREBASE_APPLE_UID_PREFIX")
    muxlisa_voice_text_api_key: str = Field(..., env="MUXLISA_VOICE_TEXT_API_KEY")
    muxlisa_voice_text_url: str = Field(
        "https://service.muxlisa.uz/api/v2/stt", env="MUXLISA_VOICE_TEXT_URL"
    )
    cbu_rates_url: str = Field(
        "https://cbu.uz/uz/arkhiv-kursov-valyut/json/",
        env="CBU_RATES_URL",
    )
    cbu_cache_ttl_seconds: int = Field(21600, env="CBU_CACHE_TTL_SECONDS")

    openai_api_key: str | None = Field(None, env="OPENAI_API_KEY")
    openai_model: str = Field("gpt-4o", env="OPENAI_MODEL")
    openai_timeout_seconds: int = Field(30, env="OPENAI_TIMEOUT_SECONDS")

    admin_uids: str = Field("", env="ADMIN_UIDS")

    google_play_package_name: str | None = Field(None, env="GOOGLE_PLAY_PACKAGE_NAME")
    google_play_service_account_path: str | None = Field(
        None, env="GOOGLE_PLAY_SERVICE_ACCOUNT_PATH"
    )
    google_play_subscription_ids: str = Field("", env="GOOGLE_PLAY_SUBSCRIPTION_IDS")
    google_play_product_ids: str = Field("", env="GOOGLE_PLAY_PRODUCT_IDS")

    apple_bundle_id: str | None = Field(None, env="APPLE_BUNDLE_ID")
    apple_shared_secret: str | None = Field(None, env="APPLE_SHARED_SECRET")
    apple_subscription_ids: str = Field("", env="APPLE_SUBSCRIPTION_IDS")
    apple_product_ids: str = Field("", env="APPLE_PRODUCT_IDS")
    apple_auth_audiences: str = Field("", env="APPLE_AUTH_AUDIENCES")
    default_permissions_free: str = Field("{}", env="DEFAULT_PERMISSIONS_FREE")
    default_permissions_premium: str = Field("{}", env="DEFAULT_PERMISSIONS_PREMIUM")
    default_ads_config_ios: str = Field("{}", env="DEFAULT_ADS_CONFIG_IOS")
    default_ads_config_android: str = Field("{}", env="DEFAULT_ADS_CONFIG_ANDROID")

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    @property
    def valid_audiences(self) -> List[str]:
        # Enforce the single Web client ID audience for all platforms
        return [self.google_web_client_id]

    @property
    def admin_uid_set(self) -> set[str]:
        return {uid.strip() for uid in self.admin_uids.split(",") if uid.strip()}

    @property
    def google_play_subscription_id_set(self) -> set[str]:
        return {
            pid.strip()
            for pid in self.google_play_subscription_ids.split(",")
            if pid.strip()
        }

    @property
    def google_play_product_id_set(self) -> set[str]:
        return {
            pid.strip()
            for pid in self.google_play_product_ids.split(",")
            if pid.strip()
        }

    @property
    def apple_subscription_id_set(self) -> set[str]:
        return {
            pid.strip()
            for pid in self.apple_subscription_ids.split(",")
            if pid.strip()
        }

    @property
    def apple_product_id_set(self) -> set[str]:
        return {
            pid.strip()
            for pid in self.apple_product_ids.split(",")
            if pid.strip()
        }

    @property
    def apple_auth_audience_set(self) -> set[str]:
        configured = {
            audience.strip()
            for audience in self.apple_auth_audiences.split(",")
            if audience.strip()
        }
        if configured:
            return configured
        if self.apple_bundle_id:
            return {self.apple_bundle_id.strip()}
        return set()

    @property
    def default_permissions_free_dict(self) -> Dict[str, Any]:
        try:
            data = json.loads(self.default_permissions_free)
        except Exception:
            data = {}
        if isinstance(data, dict):
            return {str(k): v for k, v in data.items()}
        return {}

    @property
    def default_permissions_premium_dict(self) -> Dict[str, Any]:
        try:
            data = json.loads(self.default_permissions_premium)
        except Exception:
            data = {}
        if isinstance(data, dict):
            return {str(k): v for k, v in data.items()}
        return {}

    @property
    def default_ads_config_ios_dict(self) -> Dict[str, Any]:
        try:
            data = json.loads(self.default_ads_config_ios)
        except Exception:
            data = {}
        if isinstance(data, dict):
            return {str(k): v for k, v in data.items()}
        return {}

    @property
    def default_ads_config_android_dict(self) -> Dict[str, Any]:
        try:
            data = json.loads(self.default_ads_config_android)
        except Exception:
            data = {}
        if isinstance(data, dict):
            return {str(k): v for k, v in data.items()}
        return {}


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    return Settings()

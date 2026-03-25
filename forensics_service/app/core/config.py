from pydantic import BaseModel


class Settings(BaseModel):
    app_name: str = "Digital Forensic Analysis Service"
    app_version: str = "1.0.0"
    max_upload_mb: int = 1024
    temp_dir: str = "./tmp"

    # Fusion weights should sum approximately to 1.0
    w_metadata: float = 0.15
    w_pixel: float = 0.20
    w_deepfake: float = 0.25
    w_video_temporal: float = 0.15
    w_audio: float = 0.15
    w_multimodal: float = 0.10


settings = Settings()

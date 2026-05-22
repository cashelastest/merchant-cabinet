import sys
from loguru import logger


def setup_logging(
    level: str = "INFO",
    log_file: str = "logs/app.log",
    rotation: str = "10 MB",
    retention: str = "7 days",
    serialize: bool = False,
) -> None:
    logger.remove()

    logger.add(
        sys.stdout,
        level=level,
        colorize=True,
        format=(
            "<green>{time:YYYY-MM-DD HH:mm:ss}</green> | "
            "<level>{level: <8}</level> | "
            "<cyan>{name}</cyan>:<cyan>{function}</cyan>:<cyan>{line}</cyan> | "
            "<level>{message}</level>"
        ),
    )


    logger.add(
        log_file,
        level=level,
        rotation=rotation,
        retention=retention,
        compression="zip",
        serialize=serialize,
        enqueue=True,
        backtrace=True,
        diagnose=True,
    )
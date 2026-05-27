from abc import ABC
from repositories import BaseRepository


class BaseService(ABC):
    
    def __init__(self, repository: BaseRepository) -> None:
        self.repository = repository

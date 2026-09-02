from enum import Enum


class DealStatus(str, Enum):
    PENDING = "pending"
    IN_PROGRESS = "in_progress"
    ACCEPTED = "accepted"
    REFUSED = "refused"

"""Event-driven alert fan-out via Google Cloud Pub/Sub.

Publishing is best-effort: if the Pub/Sub library, topic, or permissions are
unavailable the alert is still generated and recorded in Firestore, so a demo
never breaks on infrastructure gaps. A downstream subscriber (Cloud Function,
SMS/WhatsApp gateway) can consume the topic to actually deliver messages.
"""

from __future__ import annotations

import json

from app.config import settings

_publisher = None
_topic_path: str | None = None


def _get_publisher():
    global _publisher, _topic_path
    if _publisher is None:
        from google.cloud import pubsub_v1  # imported lazily so it stays optional

        _publisher = pubsub_v1.PublisherClient()
        _topic_path = _publisher.topic_path(
            settings.gcp_project, settings.pubsub_alert_topic
        )
    return _publisher, _topic_path


def publish_alert(payload: dict) -> dict:
    """Publish an alert event to Pub/Sub. Returns a dispatch receipt."""
    try:
        publisher, topic_path = _get_publisher()
        data = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        future = publisher.publish(topic_path, data, source="resq-bharat")
        message_id = future.result(timeout=10)
        return {"published": True, "message_id": message_id, "topic": topic_path}
    except Exception as e:  # topic missing / no perms / lib absent -> graceful
        return {
            "published": False,
            "channel": "simulated",
            "detail": str(e)[:200],
        }

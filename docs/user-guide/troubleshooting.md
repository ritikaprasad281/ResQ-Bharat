# Troubleshooting

Common issues and what they mean. Many "problems" are the app being honest about
data it couldn't compute — not a fault on your side.

## A panel says "data unavailable"

The app couldn't compute that layer for your area right now (e.g. no cloud-free
satellite image, or an upstream service was busy). This is intentional honesty, not
a placeholder. Try again later, or select a different area.

## Imagery won't load / shows "unavailable"

Before/after satellite composites need clean, low-cloud scenes. If none were
available, the app shows "unavailable" rather than a misleading picture. Monsoon
months are especially cloudy.

## The map or zones take a while to appear

Heavy layers (zones, construction, imagery) are computed from satellite data and can
take several seconds the first time. Once ready, they load quickly. See
[Performance & reliability](../technical/performance-and-reliability.md).

## Risk shows but rainfall data looks incomplete

The risk reading flags when some rainfall days were missing. The score is still
shown, but treat incomplete readings with extra caution.

## The AI assistant doesn't respond

AI features need the service to be configured with an API key. If it's unavailable,
these features may not answer. Non-AI features (risk, zones, forecast, reports)
still work.

## Voice input isn't working

- Check your browser's **microphone permission**.
- Voice support depends on your **browser and device** and isn't available
  everywhere.
- You can always type instead. See [Multilingual & voice](multilingual-and-voice.md).

## My language isn't fully translated

The interface supports ten languages. If something appears in English, it may not be
translated yet. The **AI assistant** can still answer in your language.

## A report didn't save

If submitting a report fails, the storage service may be temporarily unavailable.
Try again shortly. Required fields are location, hazard type, and severity.

## Numbers look different from before

Risk and forecast change as new rainfall data arrives; cached layers show the time
they were generated. Differences usually reflect updated data, not an error.

## Still stuck?

```mermaid
flowchart LR
    Issue["Something's wrong"] --> Retry["Wait & retry"]
    Retry --> Other["Try another area / feature"]
    Other --> Check["Check methodology & data-quality page"]
    Check --> Report["Report a persistent bug to the maintainers"]
```

See also [Methodology & data quality](methodology-and-data-quality.md) and the
[FAQ](frequently-asked-questions.md).

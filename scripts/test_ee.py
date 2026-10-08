"""Quick Earth Engine connectivity + registration test for the ganga-flood project."""

import ee

PROJECT = "ganga-flood"

try:
    ee.Initialize(project=PROJECT)
    # Trivial server-side computation proves auth works.
    print("Compute check (1+1):", ee.Number(1).add(1).getInfo())
    # Real dataset access proves the project is registered for Earth Engine.
    dem = ee.Image("USGS/SRTMGL1_003")
    print("SRTM bands:", dem.bandNames().getInfo())
    # A Ganga-region sample: mean elevation near Patna.
    patna = ee.Geometry.Point([85.14, 25.59]).buffer(5000)
    elev = dem.reduceRegion(
        reducer=ee.Reducer.mean(), geometry=patna, scale=90
    ).get("elevation")
    print("Mean elevation near Patna (m):", ee.Number(elev).getInfo())
    print("\n EARTH ENGINE WORKS — project is registered and authenticated.")
except Exception as e:
    print("\n EARTH ENGINE FAILED:")
    print(type(e).__name__, str(e))
    print(
        "\nIf this mentions 'not registered' or 'permission', go to "
        "https://code.earthengine.google.com and register the 'ganga-flood' "
        "project (Noncommercial / Unpaid), then retry."
    )

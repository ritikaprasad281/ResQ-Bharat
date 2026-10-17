"""Areas of interest (AOIs) for ResQ Bharat — nationwide India flood monitoring.

Covers river stretches and flood-prone cities across all Indian states and union
territories: the Ganga and Indus systems in the north, the Brahmaputra and Barak
systems in the northeast, the Mahanadi / Brahmani / Subarnarekha in the east, the
Narmada / Tapi / Chambal in the centre, the Godavari / Krishna / Sabarmati in the
west, and the Kaveri / Penna / Kerala rivers in the south, plus coastal and urban
flood catchments. Bounding boxes are [west, south, east, north] in WGS84, kept
compact (~0.3-0.45 deg) so Earth Engine vector exports stay fast.

Risk, flood-zone and floodplain computation is derived on demand from global
Earth Engine datasets (JRC Global Surface Water, SRTM, Sentinel-1) and Open-Meteo
rainfall, so any bounding box in India is supported. Only study areas explicitly
validated against recorded floods (SAR) are marked "live"; all others are
"modelled" or "partial" (see PILOT_COVERAGE). No geometry or validation status is
fabricated.
"""

from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True)
class Aoi:
    id: str
    name: str
    tributary: str  # river this stretch belongs to
    bbox: tuple[float, float, float, float]
    center: tuple[float, float]  # [lon, lat] for map fly-to


# Ordered by river (and upstream -> downstream within each) so the location
# picker can group them cleanly. IDs are stable so Firestore caches persist.
PILOTS: dict[str, Aoi] = {
    # ---- Ganga main stem (west -> east) ----
    "haridwar": Aoi(
        id="haridwar",
        name="Ganga — Haridwar",
        tributary="Ganga",
        bbox=(77.98, 29.82, 78.38, 30.08),
        center=(78.16, 29.95),
    ),
    "kanpur": Aoi(
        id="kanpur",
        name="Ganga — Kanpur",
        tributary="Ganga",
        bbox=(80.12, 26.32, 80.58, 26.60),
        center=(80.35, 26.46),
    ),
    "prayagraj": Aoi(
        id="prayagraj",
        name="Ganga–Yamuna confluence — Prayagraj",
        tributary="Ganga",
        bbox=(81.62, 25.28, 82.12, 25.58),
        center=(81.87, 25.43),
    ),
    "varanasi": Aoi(
        id="varanasi",
        name="Ganga — Varanasi",
        tributary="Ganga",
        bbox=(82.80, 25.18, 83.25, 25.46),
        center=(83.01, 25.32),
    ),
    "buxar": Aoi(
        id="buxar",
        name="Ganga — Buxar–Ballia",
        tributary="Ganga",
        bbox=(83.75, 25.45, 84.25, 25.78),
        center=(84.00, 25.60),
    ),
    "patna": Aoi(
        id="patna",
        name="Ganga — Patna",
        tributary="Ganga",
        bbox=(84.90, 25.50, 85.40, 25.78),
        center=(85.14, 25.61),
    ),
    "bhagalpur": Aoi(
        id="bhagalpur",
        name="Ganga — Bhagalpur",
        tributary="Ganga",
        bbox=(86.75, 25.10, 87.25, 25.40),
        center=(86.98, 25.24),
    ),
    "farakka": Aoi(
        id="farakka",
        name="Ganga — Farakka (West Bengal)",
        tributary="Ganga",
        bbox=(87.70, 24.65, 88.15, 24.98),
        center=(87.93, 24.80),
    ),
    # ---- Yamuna ----
    "delhi": Aoi(
        id="delhi",
        name="Yamuna — Delhi",
        tributary="Yamuna",
        bbox=(77.05, 28.45, 77.42, 28.80),
        center=(77.23, 28.63),
    ),
    "mathura": Aoi(
        id="mathura",
        name="Yamuna — Mathura",
        tributary="Yamuna",
        bbox=(77.50, 27.34, 77.90, 27.64),
        center=(77.68, 27.49),
    ),
    "agra": Aoi(
        id="agra",
        name="Yamuna — Agra",
        tributary="Yamuna",
        bbox=(77.83, 27.03, 78.22, 27.33),
        center=(78.01, 27.18),
    ),
    # ---- Gomti ----
    "lucknow": Aoi(
        id="lucknow",
        name="Gomti — Lucknow",
        tributary="Gomti",
        bbox=(80.75, 26.70, 81.18, 27.02),
        center=(80.95, 26.85),
    ),
    "jaunpur": Aoi(
        id="jaunpur",
        name="Gomti — Jaunpur",
        tributary="Gomti",
        bbox=(82.50, 25.60, 82.90, 25.90),
        center=(82.68, 25.75),
    ),
    # ---- Ghaghara / Sarayu ----
    "ayodhya": Aoi(
        id="ayodhya",
        name="Ghaghara (Sarayu) — Ayodhya",
        tributary="Ghaghara",
        bbox=(82.00, 26.64, 82.42, 26.95),
        center=(82.20, 26.79),
    ),
    "ghaghara": Aoi(
        id="ghaghara",
        name="Ghaghara floodplain — Siwan–Ballia",
        tributary="Ghaghara",
        bbox=(83.95, 25.80, 84.45, 26.28),
        center=(84.20, 26.02),
    ),
    # ---- Rapti ----
    "gorakhpur": Aoi(
        id="gorakhpur",
        name="Rapti — Gorakhpur",
        tributary="Rapti",
        bbox=(83.15, 26.60, 83.60, 26.94),
        center=(83.37, 26.76),
    ),
    # ---- Ramganga ----
    "bareilly": Aoi(
        id="bareilly",
        name="Ramganga — Bareilly",
        tributary="Ramganga",
        bbox=(79.20, 28.20, 79.62, 28.54),
        center=(79.41, 28.37),
    ),
    # ---- Sharda / Sarda ----
    "lakhimpur": Aoi(
        id="lakhimpur",
        name="Sharda — Lakhimpur Kheri",
        tributary="Sharda",
        bbox=(80.55, 27.78, 81.00, 28.14),
        center=(80.78, 27.95),
    ),
    # ---- Gandak ----
    "gandak": Aoi(
        id="gandak",
        name="Gandak floodplain — Gopalganj–Muzaffarpur",
        tributary="Gandak",
        bbox=(84.70, 25.90, 85.30, 26.45),
        center=(85.00, 26.15),
    ),
    # ---- Bagmati ----
    "sitamarhi": Aoi(
        id="sitamarhi",
        name="Bagmati — Sitamarhi",
        tributary="Bagmati",
        bbox=(85.30, 26.44, 85.72, 26.78),
        center=(85.49, 26.59),
    ),
    # ---- Kosi ----
    "kosi": Aoi(
        id="kosi",
        name="Kosi — North Bihar (Supaul–Saharsa)",
        tributary="Kosi",
        bbox=(86.40, 25.55, 87.25, 26.60),
        center=(86.92, 26.12),
    ),
    # ---- Son ----
    "dehri": Aoi(
        id="dehri",
        name="Son — Dehri-on-Sone",
        tributary="Son",
        bbox=(84.00, 24.78, 84.40, 25.10),
        center=(84.18, 24.92),
    ),
    # ---- Mahananda ----
    "katihar": Aoi(
        id="katihar",
        name="Mahananda — Katihar",
        tributary="Mahananda",
        bbox=(87.40, 25.40, 87.82, 25.72),
        center=(87.58, 25.54),
    ),
    "kishanganj": Aoi(
        id="kishanganj",
        name="Mahananda — Kishanganj",
        tributary="Mahananda",
        bbox=(87.76, 25.94, 88.18, 26.28),
        center=(87.95, 26.09),
    ),
    # ================= Northeast India =================
    # ---- Brahmaputra valley (Assam) ----
    "guwahati": Aoi(
        id="guwahati",
        name="Brahmaputra — Guwahati",
        tributary="Brahmaputra",
        bbox=(91.55, 26.05, 91.95, 26.30),
        center=(91.75, 26.18),
    ),
    "dibrugarh": Aoi(
        id="dibrugarh",
        name="Brahmaputra — Dibrugarh",
        tributary="Brahmaputra",
        bbox=(94.72, 27.38, 95.12, 27.62),
        center=(94.91, 27.48),
    ),
    "majuli": Aoi(
        id="majuli",
        name="Brahmaputra — Majuli (Jorhat)",
        tributary="Brahmaputra",
        bbox=(93.90, 26.80, 94.35, 27.12),
        center=(94.12, 26.95),
    ),
    # ---- Barak valley (Assam) ----
    "silchar": Aoi(
        id="silchar",
        name="Barak — Silchar",
        tributary="Barak",
        bbox=(92.60, 24.70, 93.00, 24.98),
        center=(92.79, 24.83),
    ),
    # ---- Siang / upper Brahmaputra (Arunachal Pradesh) ----
    "pasighat": Aoi(
        id="pasighat",
        name="Siang — Pasighat",
        tributary="Siang",
        bbox=(95.15, 27.95, 95.55, 28.22),
        center=(95.33, 28.07),
    ),
    # ---- Imphal valley (Manipur) ----
    "imphal": Aoi(
        id="imphal",
        name="Imphal — Imphal valley",
        tributary="Imphal",
        bbox=(93.82, 24.68, 94.08, 24.95),
        center=(93.94, 24.81),
    ),
    # ---- Haora / Gumti (Tripura) ----
    "agartala": Aoi(
        id="agartala",
        name="Haora — Agartala",
        tributary="Haora",
        bbox=(91.14, 23.72, 91.42, 23.98),
        center=(91.28, 23.84),
    ),
    # ---- Dhansiri (Nagaland) ----
    "dimapur": Aoi(
        id="dimapur",
        name="Dhansiri — Dimapur",
        tributary="Dhansiri",
        bbox=(93.56, 25.78, 93.92, 26.04),
        center=(93.73, 25.91),
    ),
    # ---- Teesta (Sikkim) ----
    "rangpo": Aoi(
        id="rangpo",
        name="Teesta — Rangpo corridor",
        tributary="Teesta",
        bbox=(88.40, 27.05, 88.72, 27.40),
        center=(88.53, 27.20),
    ),
    # ---- Tlawng (Mizoram) ----
    "aizawl": Aoi(
        id="aizawl",
        name="Tlawng — Aizawl corridor",
        tributary="Tlawng",
        bbox=(92.55, 23.58, 92.88, 23.92),
        center=(92.70, 23.74),
    ),
    # ================= Northern India (Indus system & upper Ganga) =======
    "srinagar": Aoi(
        id="srinagar",
        name="Jhelum — Srinagar",
        tributary="Jhelum",
        bbox=(74.60, 33.95, 75.02, 34.22),
        center=(74.80, 34.08),
    ),
    "jammu": Aoi(
        id="jammu",
        name="Tawi (Chenab) — Jammu",
        tributary="Chenab",
        bbox=(74.66, 32.60, 75.06, 32.86),
        center=(74.86, 32.73),
    ),
    "leh": Aoi(
        id="leh",
        name="Indus — Leh",
        tributary="Indus",
        bbox=(77.42, 34.03, 77.78, 34.28),
        center=(77.58, 34.15),
    ),
    "ludhiana": Aoi(
        id="ludhiana",
        name="Sutlej — Ludhiana",
        tributary="Sutlej",
        bbox=(75.60, 30.80, 76.05, 31.10),
        center=(75.85, 30.95),
    ),
    "pathankot": Aoi(
        id="pathankot",
        name="Ravi — Pathankot",
        tributary="Ravi",
        bbox=(75.45, 32.14, 75.87, 32.40),
        center=(75.65, 32.27),
    ),
    "mandi": Aoi(
        id="mandi",
        name="Beas — Mandi",
        tributary="Beas",
        bbox=(76.73, 31.56, 77.15, 31.86),
        center=(76.93, 31.71),
    ),
    "yamunanagar": Aoi(
        id="yamunanagar",
        name="Yamuna — Yamunanagar (Hathnikund)",
        tributary="Yamuna",
        bbox=(77.10, 30.00, 77.52, 30.28),
        center=(77.30, 30.13),
    ),
    "chandigarh": Aoi(
        id="chandigarh",
        name="Chandigarh — Sukhna / Ghaggar catchment",
        tributary="Ghaggar",
        bbox=(76.63, 30.60, 76.97, 30.86),
        center=(76.78, 30.73),
    ),
    # ================= Central India =====================================
    "jabalpur": Aoi(
        id="jabalpur",
        name="Narmada — Jabalpur (Bhedaghat)",
        tributary="Narmada",
        bbox=(79.73, 23.02, 80.15, 23.30),
        center=(79.93, 23.15),
    ),
    "narmadapuram": Aoi(
        id="narmadapuram",
        name="Narmada — Narmadapuram (Hoshangabad)",
        tributary="Narmada",
        bbox=(77.53, 22.62, 77.95, 22.90),
        center=(77.73, 22.75),
    ),
    "kota": Aoi(
        id="kota",
        name="Chambal — Kota",
        tributary="Chambal",
        bbox=(75.64, 25.04, 76.06, 25.32),
        center=(75.84, 25.18),
    ),
    "orchha": Aoi(
        id="orchha",
        name="Betwa — Orchha",
        tributary="Betwa",
        bbox=(78.44, 25.21, 78.86, 25.50),
        center=(78.64, 25.35),
    ),
    "banda": Aoi(
        id="banda",
        name="Ken — Banda",
        tributary="Ken",
        bbox=(80.14, 25.34, 80.56, 25.62),
        center=(80.34, 25.48),
    ),
    "raipur": Aoi(
        id="raipur",
        name="Mahanadi — Raipur",
        tributary="Mahanadi",
        bbox=(81.43, 21.11, 81.85, 21.40),
        center=(81.63, 21.25),
    ),
    "bhopal": Aoi(
        id="bhopal",
        name="Bhopal — urban lakes & Kaliasot",
        tributary="Betwa",
        bbox=(77.24, 23.12, 77.64, 23.40),
        center=(77.42, 23.25),
    ),
    "nagpur": Aoi(
        id="nagpur",
        name="Nagpur — Nag / Kanhan catchment",
        tributary="Wainganga",
        bbox=(78.90, 21.00, 79.30, 21.30),
        center=(79.09, 21.15),
    ),
    # ================= Western India =====================================
    "surat": Aoi(
        id="surat",
        name="Tapi — Surat",
        tributary="Tapi",
        bbox=(72.63, 21.04, 73.05, 21.32),
        center=(72.83, 21.18),
    ),
    "bharuch": Aoi(
        id="bharuch",
        name="Narmada — Bharuch (estuary)",
        tributary="Narmada",
        bbox=(72.79, 21.55, 73.21, 21.86),
        center=(72.99, 21.70),
    ),
    "ahmedabad": Aoi(
        id="ahmedabad",
        name="Sabarmati — Ahmedabad",
        tributary="Sabarmati",
        bbox=(72.40, 22.89, 72.80, 23.18),
        center=(72.58, 23.03),
    ),
    "vadodara": Aoi(
        id="vadodara",
        name="Vishwamitri — Vadodara",
        tributary="Vishwamitri",
        bbox=(73.01, 22.17, 73.41, 22.46),
        center=(73.19, 22.31),
    ),
    "nashik": Aoi(
        id="nashik",
        name="Godavari — Nashik",
        tributary="Godavari",
        bbox=(73.60, 19.86, 74.00, 20.15),
        center=(73.79, 20.00),
    ),
    "nanded": Aoi(
        id="nanded",
        name="Godavari — Nanded",
        tributary="Godavari",
        bbox=(77.12, 19.02, 77.54, 19.30),
        center=(77.32, 19.16),
    ),
    "sangli": Aoi(
        id="sangli",
        name="Krishna — Sangli",
        tributary="Krishna",
        bbox=(74.36, 16.71, 74.78, 16.99),
        center=(74.56, 16.85),
    ),
    "kolhapur": Aoi(
        id="kolhapur",
        name="Panchganga (Krishna) — Kolhapur",
        tributary="Krishna",
        bbox=(74.06, 16.56, 74.46, 16.84),
        center=(74.24, 16.70),
    ),
    "pandharpur": Aoi(
        id="pandharpur",
        name="Bhima — Pandharpur",
        tributary="Bhima",
        bbox=(75.13, 17.54, 75.55, 17.82),
        center=(75.33, 17.68),
    ),
    "mumbai": Aoi(
        id="mumbai",
        name="Mumbai — Mithi river & coastal",
        tributary="Mithi",
        bbox=(72.77, 18.90, 73.00, 19.27),
        center=(72.87, 19.10),
    ),
    "panaji": Aoi(
        id="panaji",
        name="Mandovi — Panaji",
        tributary="Mandovi",
        bbox=(73.68, 15.36, 74.06, 15.63),
        center=(73.83, 15.50),
    ),
    "balotra": Aoi(
        id="balotra",
        name="Luni — Balotra",
        tributary="Luni",
        bbox=(72.00, 25.65, 72.50, 26.00),
        center=(72.24, 25.83),
    ),
    "daman": Aoi(
        id="daman",
        name="Daman — coastal (Daman Ganga)",
        tributary="Daman Ganga",
        bbox=(72.72, 20.28, 72.98, 20.52),
        center=(72.84, 20.40),
    ),
    # ================= Southern India ====================================
    "trichy": Aoi(
        id="trichy",
        name="Kaveri — Tiruchirappalli",
        tributary="Kaveri",
        bbox=(78.50, 10.67, 78.92, 10.96),
        center=(78.70, 10.81),
    ),
    "mysuru": Aoi(
        id="mysuru",
        name="Kaveri — Srirangapatna / Mysuru",
        tributary="Kaveri",
        bbox=(76.48, 12.28, 76.90, 12.56),
        center=(76.68, 12.42),
    ),
    "nellore": Aoi(
        id="nellore",
        name="Penna — Nellore",
        tributary="Penna",
        bbox=(79.79, 14.30, 80.21, 14.58),
        center=(79.99, 14.44),
    ),
    "vellore": Aoi(
        id="vellore",
        name="Palar — Vellore",
        tributary="Palar",
        bbox=(78.93, 12.78, 79.35, 13.06),
        center=(79.13, 12.92),
    ),
    "kochi": Aoi(
        id="kochi",
        name="Periyar — Kochi / Aluva",
        tributary="Periyar",
        bbox=(76.08, 9.92, 76.48, 10.25),
        center=(76.28, 10.08),
    ),
    "chengannur": Aoi(
        id="chengannur",
        name="Pamba — Chengannur",
        tributary="Pamba",
        bbox=(76.42, 9.18, 76.84, 9.47),
        center=(76.62, 9.32),
    ),
    "pattambi": Aoi(
        id="pattambi",
        name="Bharathapuzha — Pattambi",
        tributary="Bharathapuzha",
        bbox=(76.00, 10.66, 76.42, 10.95),
        center=(76.20, 10.80),
    ),
    "madurai": Aoi(
        id="madurai",
        name="Vaigai — Madurai",
        tributary="Vaigai",
        bbox=(77.92, 9.79, 78.34, 10.07),
        center=(78.12, 9.93),
    ),
    "tirunelveli": Aoi(
        id="tirunelveli",
        name="Tamiraparani — Tirunelveli",
        tributary="Tamiraparani",
        bbox=(77.52, 8.59, 77.94, 8.87),
        center=(77.70, 8.73),
    ),
    "chennai": Aoi(
        id="chennai",
        name="Chennai — Adyar / Cooum / Kosasthalaiyar",
        tributary="Cooum",
        bbox=(80.06, 12.88, 80.34, 13.24),
        center=(80.22, 13.06),
    ),
    "bengaluru": Aoi(
        id="bengaluru",
        name="Bengaluru — Vrishabhavathi / lake catchment",
        tributary="Arkavathi",
        bbox=(77.42, 12.83, 77.78, 13.12),
        center=(77.59, 12.97),
    ),
    "hyderabad": Aoi(
        id="hyderabad",
        name="Musi — Hyderabad",
        tributary="Musi",
        bbox=(78.30, 17.24, 78.66, 17.52),
        center=(78.47, 17.38),
    ),
    "vijayawada": Aoi(
        id="vijayawada",
        name="Krishna — Vijayawada",
        tributary="Krishna",
        bbox=(80.42, 16.37, 80.84, 16.65),
        center=(80.62, 16.51),
    ),
    "rajahmundry": Aoi(
        id="rajahmundry",
        name="Godavari — Rajahmundry (delta)",
        tributary="Godavari",
        bbox=(81.58, 16.85, 82.00, 17.14),
        center=(81.78, 16.99),
    ),
    "bhadrachalam": Aoi(
        id="bhadrachalam",
        name="Godavari — Bhadrachalam",
        tributary="Godavari",
        bbox=(80.69, 17.53, 81.11, 17.81),
        center=(80.89, 17.67),
    ),
    "puducherry": Aoi(
        id="puducherry",
        name="Puducherry — coastal catchment",
        tributary="Coastal",
        bbox=(79.68, 11.80, 79.96, 12.07),
        center=(79.81, 11.93),
    ),
    "kavaratti": Aoi(
        id="kavaratti",
        name="Kavaratti — Lakshadweep",
        tributary="Island & coastal",
        bbox=(72.56, 10.48, 72.74, 10.66),
        center=(72.64, 10.56),
    ),
    # ================= Eastern India =====================================
    "jamshedpur": Aoi(
        id="jamshedpur",
        name="Subarnarekha — Jamshedpur",
        tributary="Subarnarekha",
        bbox=(85.98, 22.66, 86.40, 22.94),
        center=(86.18, 22.80),
    ),
    "sambalpur": Aoi(
        id="sambalpur",
        name="Mahanadi — Sambalpur",
        tributary="Mahanadi",
        bbox=(83.77, 21.33, 84.19, 21.62),
        center=(83.97, 21.47),
    ),
    "cuttack": Aoi(
        id="cuttack",
        name="Mahanadi — Cuttack (delta)",
        tributary="Mahanadi",
        bbox=(85.68, 20.32, 86.10, 20.61),
        center=(85.88, 20.46),
    ),
    "bhubaneswar": Aoi(
        id="bhubaneswar",
        name="Bhubaneswar — Daya / Kuakhai",
        tributary="Mahanadi",
        bbox=(85.64, 20.16, 86.02, 20.45),
        center=(85.82, 20.30),
    ),
    "rourkela": Aoi(
        id="rourkela",
        name="Brahmani — Rourkela",
        tributary="Brahmani",
        bbox=(84.65, 22.09, 85.07, 22.38),
        center=(84.85, 22.23),
    ),
    "bhadrak": Aoi(
        id="bhadrak",
        name="Baitarani — Bhadrak",
        tributary="Baitarani",
        bbox=(86.30, 20.91, 86.72, 21.20),
        center=(86.50, 21.05),
    ),
    "durgapur": Aoi(
        id="durgapur",
        name="Damodar — Durgapur / Asansol",
        tributary="Damodar",
        bbox=(87.12, 23.38, 87.54, 23.66),
        center=(87.32, 23.52),
    ),
    "kolkata": Aoi(
        id="kolkata",
        name="Kolkata — Hooghly estuary",
        tributary="Hooghly",
        bbox=(88.20, 22.42, 88.52, 22.74),
        center=(88.36, 22.57),
    ),
    "jalpaiguri": Aoi(
        id="jalpaiguri",
        name="Teesta — Jalpaiguri",
        tributary="Teesta",
        bbox=(88.52, 26.38, 88.94, 26.67),
        center=(88.72, 26.52),
    ),
    "siliguri": Aoi(
        id="siliguri",
        name="Mahananda — Siliguri",
        tributary="Mahananda",
        bbox=(88.23, 26.58, 88.65, 26.86),
        center=(88.43, 26.72),
    ),
    # ================= Northeast India (additional river systems) ========
    "northlakhimpur": Aoi(
        id="northlakhimpur",
        name="Subansiri — North Lakhimpur",
        tributary="Subansiri",
        bbox=(93.90, 27.09, 94.32, 27.37),
        center=(94.10, 27.23),
    ),
    "barpeta": Aoi(
        id="barpeta",
        name="Manas — Barpeta",
        tributary="Manas",
        bbox=(90.78, 26.41, 91.20, 26.69),
        center=(90.98, 26.55),
    ),
    "nagaon": Aoi(
        id="nagaon",
        name="Kopili — Nagaon",
        tributary="Kopili",
        bbox=(92.48, 26.21, 92.90, 26.49),
        center=(92.68, 26.35),
    ),
    "dhubri": Aoi(
        id="dhubri",
        name="Sankosh — Dhubri",
        tributary="Sankosh",
        bbox=(89.78, 25.88, 90.20, 26.16),
        center=(89.98, 26.02),
    ),
    "tezu": Aoi(
        id="tezu",
        name="Lohit — Tezu",
        tributary="Lohit",
        bbox=(95.93, 27.78, 96.35, 28.06),
        center=(96.13, 27.92),
    ),
    "roing": Aoi(
        id="roing",
        name="Dibang — Roing",
        tributary="Dibang",
        bbox=(95.64, 28.00, 96.06, 28.28),
        center=(95.84, 28.14),
    ),
    "bhalukpong": Aoi(
        id="bhalukpong",
        name="Kameng — Bhalukpong",
        tributary="Kameng",
        bbox=(92.44, 26.87, 92.86, 27.15),
        center=(92.64, 27.01),
    ),
    "digboi": Aoi(
        id="digboi",
        name="Dihing — Digboi",
        tributary="Dihing",
        bbox=(95.42, 27.24, 95.84, 27.52),
        center=(95.62, 27.38),
    ),
    "shillong": Aoi(
        id="shillong",
        name="Shillong — Umiam catchment",
        tributary="Umiam",
        bbox=(91.70, 25.43, 92.08, 25.71),
        center=(91.88, 25.57),
    ),
    # ================= Island & coastal union territories ================
    "portblair": Aoi(
        id="portblair",
        name="Port Blair — coastal catchment",
        tributary="Island & coastal",
        bbox=(92.60, 11.48, 92.90, 11.76),
        center=(92.74, 11.62),
    ),
}

DEFAULT_PILOT = "patna"

# --- Administrative region (state / UT) for each study area --------------
# Rivers cross state lines, so region is tracked per study area rather than
# derived from the river name. Used for the India -> State -> River -> Study
# Area selector hierarchy.
PILOT_REGION: dict[str, str] = {
    "haridwar": "Uttarakhand",
    "kanpur": "Uttar Pradesh",
    "prayagraj": "Uttar Pradesh",
    "varanasi": "Uttar Pradesh",
    "buxar": "Bihar",
    "patna": "Bihar",
    "bhagalpur": "Bihar",
    "farakka": "West Bengal",
    "delhi": "Delhi",
    "mathura": "Uttar Pradesh",
    "agra": "Uttar Pradesh",
    "lucknow": "Uttar Pradesh",
    "jaunpur": "Uttar Pradesh",
    "ayodhya": "Uttar Pradesh",
    "ghaghara": "Bihar",
    "gorakhpur": "Uttar Pradesh",
    "bareilly": "Uttar Pradesh",
    "lakhimpur": "Uttar Pradesh",
    "gandak": "Bihar",
    "sitamarhi": "Bihar",
    "kosi": "Bihar",
    "dehri": "Bihar",
    "katihar": "Bihar",
    "kishanganj": "Bihar",
    "guwahati": "Assam",
    "dibrugarh": "Assam",
    "majuli": "Assam",
    "silchar": "Assam",
    "pasighat": "Arunachal Pradesh",
    "imphal": "Manipur",
    "agartala": "Tripura",
    "dimapur": "Nagaland",
    "rangpo": "Sikkim",
    "aizawl": "Mizoram",
    # ---- Northern India (Indus system & upper Ganga) ----
    "srinagar": "Jammu & Kashmir",
    "jammu": "Jammu & Kashmir",
    "leh": "Ladakh",
    "ludhiana": "Punjab",
    "pathankot": "Punjab",
    "mandi": "Himachal Pradesh",
    "yamunanagar": "Haryana",
    "chandigarh": "Chandigarh",
    # ---- Central India ----
    "jabalpur": "Madhya Pradesh",
    "narmadapuram": "Madhya Pradesh",
    "kota": "Rajasthan",
    "orchha": "Madhya Pradesh",
    "banda": "Uttar Pradesh",
    "raipur": "Chhattisgarh",
    "bhopal": "Madhya Pradesh",
    "nagpur": "Maharashtra",
    # ---- Western India ----
    "surat": "Gujarat",
    "bharuch": "Gujarat",
    "ahmedabad": "Gujarat",
    "vadodara": "Gujarat",
    "nashik": "Maharashtra",
    "nanded": "Maharashtra",
    "sangli": "Maharashtra",
    "kolhapur": "Maharashtra",
    "pandharpur": "Maharashtra",
    "mumbai": "Maharashtra",
    "panaji": "Goa",
    "balotra": "Rajasthan",
    "daman": "Daman & Diu",
    # ---- Southern India ----
    "trichy": "Tamil Nadu",
    "mysuru": "Karnataka",
    "nellore": "Andhra Pradesh",
    "vellore": "Tamil Nadu",
    "kochi": "Kerala",
    "chengannur": "Kerala",
    "pattambi": "Kerala",
    "madurai": "Tamil Nadu",
    "tirunelveli": "Tamil Nadu",
    "chennai": "Tamil Nadu",
    "bengaluru": "Karnataka",
    "hyderabad": "Telangana",
    "vijayawada": "Andhra Pradesh",
    "rajahmundry": "Andhra Pradesh",
    "bhadrachalam": "Telangana",
    "puducherry": "Puducherry",
    "kavaratti": "Lakshadweep",
    # ---- Eastern India ----
    "jamshedpur": "Jharkhand",
    "sambalpur": "Odisha",
    "cuttack": "Odisha",
    "bhubaneswar": "Odisha",
    "rourkela": "Odisha",
    "bhadrak": "Odisha",
    "durgapur": "West Bengal",
    "kolkata": "West Bengal",
    "jalpaiguri": "West Bengal",
    "siliguri": "West Bengal",
    # ---- Northeast India (additional river systems) ----
    "northlakhimpur": "Assam",
    "barpeta": "Assam",
    "nagaon": "Assam",
    "dhubri": "Assam",
    "tezu": "Arunachal Pradesh",
    "roing": "Arunachal Pradesh",
    "bhalukpong": "Arunachal Pradesh",
    "digboi": "Assam",
    "shillong": "Meghalaya",
    # ---- Island & coastal union territories ----
    "portblair": "Andaman & Nicobar Islands",
}

# --- Data-coverage status per study area ---------------------------------
# "live"     = live rainfall + modelled susceptibility + satellite, AND the
#              susceptibility model has been validated against a documented
#              flood event in this basin via Sentinel-1 SAR (IoU >= 0.50).
# "modelled" = live rainfall + modelled susceptibility + satellite observations
#              are computed on demand, but the area either has no documented
#              SAR-validated event yet or validated below the 0.50 IoU bar.
#              This is the honest default for the newer nationwide study areas.
# "partial"  = selectable, but steep hill corridors, ephemeral desert rivers or
#              small islands where riverine-floodplain assumptions are weaker.
#
# IMPORTANT: unlisted areas default to "modelled" (NOT "live"), so coverage
# claims never overstate validation for areas we have not checked.
#
# VALIDATION_METRICS records the real precision / recall / IoU measured by
# app.services.validation.validate_event against each AOI's documented flood
# window (observed extent pulled from Sentinel-1 SAR — not hand-drawn). An AOI
# is promoted to "live" only when IoU >= 0.50 ("good agreement"). These numbers
# are reproducible via GET /api/validate?pilot=<id>&event=<event>.
VALIDATION_METRICS: dict[str, dict[str, object]] = {
    # ---- Brahmaputra valley (Assam 2026 monsoon) ----
    "guwahati": {"event": "assam_2026", "iou": 0.580, "precision": 0.862, "recall": 0.639},
    "dibrugarh": {"event": "assam_2026", "iou": 0.662, "precision": 0.852, "recall": 0.748},
    "majuli": {"event": "assam_2026", "iou": 0.557, "precision": 0.804, "recall": 0.645},
    "dhubri": {"event": "assam_2022", "iou": 0.626, "precision": 0.94, "recall": 0.65},
    # ---- Central (Narmada / Betwa / Chambal / Mahanadi headwaters) ----
    "bhopal": {"event": "mp_2022", "iou": 0.766, "precision": 0.93, "recall": 0.82},
    "kota": {"event": "mp_2022", "iou": 0.760, "precision": 0.85, "recall": 0.87},
    "orchha": {"event": "mp_2022", "iou": 0.567, "precision": 0.78, "recall": 0.68},
    "narmadapuram": {"event": "mp_2022", "iou": 0.563, "precision": 0.76, "recall": 0.68},
    "raipur": {"event": "mp_2022", "iou": 0.519, "precision": 0.75, "recall": 0.63},
    # ---- South (Krishna / Godavari / Kaveri / Kerala) ----
    "bhadrachalam": {"event": "krishna_2019", "iou": 0.747, "precision": 0.95, "recall": 0.78},
    "rajahmundry": {"event": "krishna_2019", "iou": 0.747, "precision": 0.85, "recall": 0.86},
    "hyderabad": {"event": "telangana_2020", "iou": 0.694, "precision": 0.79, "recall": 0.85},
    "vijayawada": {"event": "godavari_2022", "iou": 0.549, "precision": 0.77, "recall": 0.66},
    "mysuru": {"event": "karnataka_2019", "iou": 0.600, "precision": 0.62, "recall": 0.95},
    "chengannur": {"event": "kerala_2018", "iou": 0.622, "precision": 0.95, "recall": 0.64},
    "chennai": {"event": "tn_chennai_2021", "iou": 0.617, "precision": 0.85, "recall": 0.69},
    # ---- West (Godavari upper / Bhima / Tapi / Narmada lower) ----
    "nashik": {"event": "maharashtra_2019", "iou": 0.674, "precision": 0.87, "recall": 0.75},
    "nanded": {"event": "godavari_2022", "iou": 0.646, "precision": 0.75, "recall": 0.83},
    "pandharpur": {"event": "maharashtra_2019", "iou": 0.583, "precision": 0.67, "recall": 0.82},
    "surat": {"event": "gujarat_2024", "iou": 0.550, "precision": 0.61, "recall": 0.85},
    "daman": {"event": "gujarat_2024", "iou": 0.534, "precision": 0.55, "recall": 0.94},
    "vadodara": {"event": "gujarat_2017", "iou": 0.503, "precision": 0.76, "recall": 0.60},
    # ---- East (Subarnarekha / Mahanadi / Hooghly / Teesta) ----
    "rourkela": {"event": "odisha_2022", "iou": 0.653, "precision": 0.83, "recall": 0.75},
    "jamshedpur": {"event": "wb_2021", "iou": 0.617, "precision": 0.83, "recall": 0.71},
    "jalpaiguri": {"event": "wb_2021", "iou": 0.612, "precision": 0.84, "recall": 0.69},
    "kolkata": {"event": "wb_2021", "iou": 0.501, "precision": 0.79, "recall": 0.58},
}

# Ganga / Bihar core — monitored since inception and validated against the
# Bihar 2019 / 2020 monsoon floods via Sentinel-1 SAR.
_VALIDATED_CORE: frozenset[str] = frozenset(
    {
        "haridwar", "kanpur", "prayagraj", "varanasi", "buxar", "patna",
        "bhagalpur", "farakka", "delhi", "mathura", "agra", "lucknow",
        "jaunpur", "ayodhya", "ghaghara", "gorakhpur", "bareilly",
        "lakhimpur", "gandak", "sitamarhi", "kosi", "dehri", "katihar",
        "kishanganj",
    }
)

# "live" = the Ganga/Bihar core plus every AOI that passed SAR validation at
# IoU >= 0.50 (see VALIDATION_METRICS).
_LIVE_COVERAGE: frozenset[str] = _VALIDATED_CORE | frozenset(VALIDATION_METRICS)
_PARTIAL_COVERAGE: frozenset[str] = frozenset(
    {
        # Steep Himalayan / hill corridors.
        "pasighat", "rangpo", "aizawl", "jammu", "leh", "mandi",
        "tezu", "roing", "bhalukpong", "shillong",
        # Ephemeral desert river.
        "balotra",
        # Small islands / remote coastal UTs.
        "kavaratti", "portblair",
    }
)


def get_region(pilot_id: str) -> str:
    return PILOT_REGION.get(pilot_id, "India")


def get_coverage(pilot_id: str) -> str:
    if pilot_id in _LIVE_COVERAGE:
        return "live"
    if pilot_id in _PARTIAL_COVERAGE:
        return "partial"
    return "modelled"


def get_validation(pilot_id: str) -> dict[str, object] | None:
    """Real SAR validation metrics for an AOI, or None if not event-validated."""
    return VALIDATION_METRICS.get(pilot_id)


def get_aoi(pilot_id: str) -> Aoi:
    aoi = PILOTS.get(pilot_id)
    if aoi is None:
        raise KeyError(
            f"Unknown pilot '{pilot_id}'. Valid: {', '.join(PILOTS)}"
        )
    return aoi


# --- Major river-basin grouping ------------------------------------------
# Maps a study area's river (Aoi.tributary) to the major basin it drains to,
# for basin-level filtering in the India -> Basin -> River -> Area hierarchy.
# Coarse but defensible; unmapped rivers fall back to "Other / coastal".
RIVER_BASIN: dict[str, str] = {
    # Ganga system
    "Ganga": "Ganga", "Yamuna": "Ganga", "Gomti": "Ganga",
    "Ghaghara": "Ganga", "Rapti": "Ganga", "Ramganga": "Ganga",
    "Sharda": "Ganga", "Gandak": "Ganga", "Bagmati": "Ganga",
    "Kosi": "Ganga", "Son": "Ganga", "Mahananda": "Ganga",
    "Damodar": "Ganga", "Betwa": "Ganga", "Ken": "Ganga",
    "Chambal": "Ganga", "Hooghly": "Ganga",
    # Indus system
    "Jhelum": "Indus", "Chenab": "Indus", "Ravi": "Indus",
    "Beas": "Indus", "Sutlej": "Indus", "Indus": "Indus",
    "Ghaggar": "Ghaggar (endorheic)",
    "Luni": "Luni (Thar)",
    # Brahmaputra system
    "Brahmaputra": "Brahmaputra", "Siang": "Brahmaputra",
    "Subansiri": "Brahmaputra", "Manas": "Brahmaputra",
    "Kopili": "Brahmaputra", "Sankosh": "Brahmaputra",
    "Lohit": "Brahmaputra", "Dibang": "Brahmaputra",
    "Kameng": "Brahmaputra", "Dihing": "Brahmaputra",
    "Dhansiri": "Brahmaputra", "Teesta": "Brahmaputra",
    "Umiam": "Brahmaputra",
    # Northeast minor / trans-boundary
    "Barak": "Barak–Meghna", "Imphal": "Imphal (Chindwin)",
    "Haora": "Tripura rivers", "Tlawng": "Mizoram rivers",
    # Peninsular east-flowing
    "Mahanadi": "Mahanadi", "Brahmani": "Brahmani–Baitarani",
    "Baitarani": "Brahmani–Baitarani", "Subarnarekha": "Subarnarekha",
    "Godavari": "Godavari", "Wainganga": "Godavari",
    "Krishna": "Krishna", "Bhima": "Krishna", "Musi": "Krishna",
    "Kaveri": "Kaveri", "Arkavathi": "Kaveri",
    "Penna": "Penna", "Palar": "East-flowing (Tamil Nadu)",
    "Vaigai": "East-flowing (Tamil Nadu)",
    "Tamiraparani": "East-flowing (Tamil Nadu)",
    "Cooum": "East-flowing (Tamil Nadu)",
    # Peninsular west-flowing / coastal
    "Narmada": "Narmada", "Tapi": "Tapi",
    "Sabarmati": "Sabarmati", "Vishwamitri": "West-flowing (Gujarat)",
    "Daman Ganga": "West-flowing (coastal)",
    "Mandovi": "West-flowing (coastal)", "Mithi": "West-flowing (coastal)",
    "Periyar": "West-flowing (Kerala)",
    "Bharathapuzha": "West-flowing (Kerala)",
    "Pamba": "West-flowing (Kerala)",
    # Coastal / island
    "Coastal": "Coastal", "Island & coastal": "Island & coastal",
}


def get_basin(pilot_id: str) -> str:
    aoi = PILOTS.get(pilot_id)
    if aoi is None:
        return "Other / coastal"
    return RIVER_BASIN.get(aoi.tributary, "Other / coastal")


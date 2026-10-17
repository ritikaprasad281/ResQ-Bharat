import {
  Satellite,
  CloudRain,
  Mountain,
  ShieldCheck,
  History,
  Waves,
  BadgeCheck,
  Languages,
} from "lucide-react";

export default function AboutPage() {
  return (
    <div className="flex-1 overflow-y-auto">
      <div className="max-w-4xl mx-auto w-full px-4 sm:px-6 py-10 space-y-8">
        <header>
          <h1 className="text-3xl font-extrabold tracking-tight">
            About ResQ Bharat
          </h1>
          <p className="mt-2 text-slate-400">
            A nationwide flood-intelligence and community-response portal for
            India&apos;s flood-prone rivers — from the Ganga and Indus systems in
            the north and the Brahmaputra in the northeast to the Godavari,
            Krishna, Narmada, Mahanadi and the rivers of the south. It pairs
            satellite flood mapping and live weather with plain-language,
            multilingual guidance for citizens and responders.
          </p>
        </header>

        <section className="grid sm:grid-cols-2 gap-4">
          {[
            {
              icon: Satellite,
              t: "Satellite flood history",
              d: "Sentinel-1 SAR flood frequency and the JRC Global Surface Water dataset identify where water has repeatedly inundated land over past monsoons.",
            },
            {
              icon: Mountain,
              t: "Terrain-aware corridors",
              d: "A DEM-based river corridor keeps mapped flood zones within reach of the channel and below a height-above-river threshold, removing false highland zones.",
            },
            {
              icon: CloudRain,
              t: "Live weather fusion",
              d: "Open-Meteo rainfall (antecedent 3-day + 7-day forecast) is combined with static susceptibility into a transparent weighted live-risk score.",
            },
            {
              icon: ShieldCheck,
              t: "AI damage estimation",
              d: "Exposed buildings and population are combined with depth–damage scenarios and Gemini-generated briefings for decision support.",
            },
          ].map((f) => (
            <div key={f.t} className="glass rounded-2xl p-4">
              <f.icon className="h-6 w-6 text-sky-400" />
              <p className="mt-2 font-semibold">{f.t}</p>
              <p className="mt-1 text-sm text-slate-400">{f.d}</p>
            </div>
          ))}
        </section>

        {/* Rivers & regions covered */}
        <section className="glass rounded-2xl p-5">
          <h2 className="font-bold flex items-center gap-2">
            <Waves className="h-5 w-5 text-sky-400" /> Rivers &amp; regions
            covered
          </h2>
          <p className="mt-2 text-sm text-slate-400">
            Coverage now spans flood-prone river stretches and urban catchments
            in <strong>every Indian state and union territory</strong>. Risk,
            flood zones and floodplain change are computed on demand from global
            Earth Engine datasets and live rainfall, so any supported location
            returns real results — with an honest coverage badge for how much
            local validation backs it.
          </p>
          <div className="mt-4 grid sm:grid-cols-2 gap-4">
            <div className="rounded-xl bg-ink-900/50 border border-white/5 p-4">
              <p className="text-sm font-semibold text-slate-200">
                North &amp; east — Ganga, Indus and eastern rivers
              </p>
              <p className="mt-1 text-[13px] text-slate-400 leading-snug">
                The Ganga main stem and tributaries (Yamuna, Gomti, Ghaghara,
                Gandak, Kosi, Son, Mahananda); the Indus system (Jhelum,
                Chenab, Ravi, Beas, Sutlej); and the Mahanadi, Brahmani,
                Baitarani, Subarnarekha and Damodar in the east.
              </p>
            </div>
            <div className="rounded-xl bg-ink-900/50 border border-white/5 p-4">
              <p className="text-sm font-semibold text-slate-200">
                Northeast, centre, west &amp; south
              </p>
              <p className="mt-1 text-[13px] text-slate-400 leading-snug">
                The Brahmaputra and its tributaries (Subansiri, Manas, Kopili,
                Lohit, Dibang, Kameng) and the Barak; the Narmada, Tapi,
                Chambal and Betwa in the centre; the Godavari, Krishna,
                Sabarmati and Mahi in the west; and the Kaveri, Penna, Vaigai,
                Periyar and Pamba in the south, plus coastal and urban
                catchments (Mumbai, Chennai, Kolkata, Hyderabad, Bengaluru).
              </p>
            </div>
          </div>
        </section>

        {/* Data coverage tiers */}
        <section className="glass rounded-2xl p-5">
          <h2 className="font-bold flex items-center gap-2">
            <BadgeCheck className="h-5 w-5 text-sky-400" /> How mature is each
            area&apos;s data?
          </h2>
          <p className="mt-2 text-sm text-slate-400">
            Every location computes real, per-location rainfall, terrain
            susceptibility and satellite observations. A coverage badge is
            honest about how much local <em>validation</em> backs it.
          </p>
          <div className="mt-4 space-y-3">
            <div className="flex gap-3">
              <span className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full bg-emerald-400" />
              <p className="text-[13px] text-slate-400">
                <span className="font-semibold text-slate-200">Live</span> —
                the susceptibility model has been validated against a documented
                flood here using Sentinel-1 SAR, scoring IoU&nbsp;&ge;&nbsp;0.50.
                Covers the Ganga/Bihar core, the Brahmaputra valley (Assam 2026)
                and ~20 basins across central, west, south and east India
                (e.g. Bhopal, Kota, Chennai, Hyderabad, the Godavari delta,
                Nashik, Surat, Kolkata) — each with its real precision/recall/IoU
                recorded.
              </p>
            </div>
            <div className="flex gap-3">
              <span className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full bg-sky-400" />
              <p className="text-[13px] text-slate-400">
                <span className="font-semibold text-slate-200">Modelled</span> —
                live rainfall, terrain and satellite layers run, but the area
                either has no documented SAR event yet or validated below the
                0.50 IoU bar (e.g. Mumbai and Kochi, where the model currently
                under-predicts extent).
              </p>
            </div>
            <div className="flex gap-3">
              <span className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full bg-amber-400" />
              <p className="text-[13px] text-slate-400">
                <span className="font-semibold text-slate-200">Partial</span> —
                steep Himalayan / hill corridors (Siang, Teesta, Beas, Lohit),
                ephemeral desert rivers (Luni) and small island UTs where
                precise river geometry and local flood-hazard mapping are still
                being integrated.
              </p>
            </div>
          </div>
        </section>

        {/* Validation events */}
        <section className="glass rounded-2xl p-5 border border-amber-500/20">
          <h2 className="font-bold flex items-center gap-2">
            <History className="h-5 w-5 text-amber-400" /> Validating against
            real floods
          </h2>
          <p className="mt-2 text-sm text-slate-400">
            North Bihar remains India&apos;s most flood-prone region — the Kosi,
            Gandak, Bagmati and Ghaghara descend from Nepal and routinely
            overtop embankments during the monsoon. Assam&apos;s Brahmaputra and
            Barak valleys flood almost every monsoon, displacing hundreds of
            thousands.
          </p>
          <p className="mt-2 text-sm text-slate-400">
            Each validation event is a satellite observation window: ResQ Bharat
            pulls the <em>actual</em> flood extent from Sentinel-1 SAR for that
            window and scores the mapped flood zones against it — reporting
            precision, recall and IoU. Events now span the country, including the{" "}
            <strong>Assam 2026</strong> and <strong>Bihar</strong> monsoons, the{" "}
            <strong>Kerala 2018</strong>, <strong>Chennai 2021</strong>,{" "}
            <strong>Hyderabad 2020</strong>, <strong>Krishna/Godavari 2019–22</strong>,{" "}
            <strong>Maharashtra 2019–21</strong>, <strong>Gujarat 2017/24</strong>,{" "}
            <strong>Madhya Pradesh 2022</strong> and <strong>Odisha/Bengal</strong>
            floods. On the Flood Intelligence page you can run any of these for
            the selected location.
          </p>
        </section>

        {/* Guidance for people */}
        <section className="glass rounded-2xl p-5">
          <h2 className="font-bold flex items-center gap-2">
            <Languages className="h-5 w-5 text-sky-400" /> Built for people, not
            just maps
          </h2>
          <p className="mt-2 text-sm text-slate-400">
            Beyond the risk maps, ResQ Bharat includes an AI Help emergency
            assistant and an offline-friendly Flood Safety guide (before,
            during and after a flood). Gemini turns the numbers into
            plain-language briefings and citizen alerts in English, Hindi,
            Bhojpuri and Maithili, and always points people to official
            emergency numbers rather than inventing local details.
          </p>
        </section>

        <p className="text-[11px] text-slate-600">
          AI-generated analysis — please validate before operational use. This
          portal is a decision-support demonstrator and not an official warning
          service. Always follow guidance from the CWC, IMD and state disaster
          authorities.
        </p>
      </div>
    </div>
  );
}


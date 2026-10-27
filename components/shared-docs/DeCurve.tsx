// DeCurve — the working document, ported from Rhea's HTML. Styles are scoped
// under .dc so they don't touch the rest of heyrhai.com. Each section carries a
// data-track label so the reading tracker can report how far someone got.

export const DECURVE_CSS = `
.dc {
  --paper: #F7F8F5; --surface: #FFFFFF; --ink: #1A1D16; --muted: #5C6157; --line: #DDE0D6;
  --fresh: #3F6B3A; --spoil: #A8601B;
  --serif: "Spectral", Georgia, "Times New Roman", serif;
  --mono: "IBM Plex Mono", ui-monospace, "SF Mono", Menlo, monospace;
  min-height: 100vh; background: var(--paper); color: var(--ink);
  font-family: var(--serif); font-size: 1.0625rem; line-height: 1.6; -webkit-font-smoothing: antialiased;
}
@media (prefers-color-scheme: dark) {
  .dc { --paper: #12140F; --surface: #191C15; --ink: #E8EAE3; --muted: #979D8D; --line: #2B2F26;
        --fresh: #86B86F; --spoil: #DBA054; color-scheme: dark; }
}
.dc * { box-sizing: border-box; }
.dc .wrap { max-width: 44rem; margin: 0 auto; padding: 3.5rem 16px 4.5rem; display: flex; flex-direction: column; gap: 3rem; }
.dc .eyebrow { font-family: var(--mono); font-size: 0.6875rem; letter-spacing: 0.14em; text-transform: uppercase; color: var(--muted); margin: 0; }
.dc h1 { font-weight: 600; font-size: clamp(2.6rem, 9vw, 4rem); line-height: 1; letter-spacing: -0.03em; margin: 0.9rem 0 0; }
.dc .tagline { font-size: clamp(1.25rem, 3.6vw, 1.55rem); line-height: 1.3; letter-spacing: -0.01em; text-wrap: balance; margin: 0.7rem 0 0; }
.dc h2 { font-weight: 600; font-size: 1.3rem; line-height: 1.25; letter-spacing: -0.005em; text-wrap: balance; margin: 0 0 0.8rem; }
.dc h3 { font-family: var(--mono); font-weight: 500; font-size: 0.8125rem; letter-spacing: 0.02em; margin: 0 0 0.3rem; }
.dc p { margin: 0 0 0.95rem; }
.dc p:last-child { margin-bottom: 0; }
.dc .standfirst { font-size: 1.1875rem; line-height: 1.5; margin-top: 1.6rem; padding-top: 1.6rem; border-top: 1px solid var(--line); max-width: 36rem; }
.dc .rule { border: 0; border-top: 1px solid var(--line); margin: 0; }
.dc .figure { margin: 0; }
.dc .figure-scroll { overflow-x: auto; }
.dc .figure svg { display: block; width: 100%; min-width: 520px; height: auto; }
.dc figcaption { font-family: var(--mono); font-size: 0.75rem; line-height: 1.55; color: var(--muted); margin-top: 0.8rem; max-width: 32rem; }
.dc .steps { display: grid; gap: 1px; background: var(--line); border: 1px solid var(--line); border-radius: 2px; overflow: hidden; }
.dc .step { background: var(--surface); padding: 1.1rem 1.25rem; }
.dc .step p { font-size: 0.975rem; line-height: 1.55; color: var(--muted); margin: 0; }
.dc table { border-collapse: collapse; width: 100%; font-size: 0.9375rem; }
.dc th, .dc td { text-align: left; vertical-align: top; padding: 0.6rem 0.9rem 0.6rem 0; border-bottom: 1px solid var(--line); }
.dc th { font-family: var(--mono); font-weight: 500; font-size: 0.75rem; letter-spacing: 0.02em; white-space: nowrap; width: 9rem; }
.dc td { color: var(--muted); line-height: 1.5; }
.dc tr.lead th { color: var(--fresh); }
.dc tr.later th, .dc tr.later td { opacity: 0.75; }
.dc .table-scroll { overflow-x: auto; }
.dc .roles { display: flex; flex-direction: column; gap: 1.2rem; }
.dc .role p { font-size: 0.975rem; line-height: 1.55; color: var(--muted); margin: 0; }
.dc .contact { display: flex; flex-direction: column; gap: 0.6rem; }
.dc .addr { font-family: var(--mono); font-size: 0.9375rem; word-break: break-all; }
.dc .note { font-family: var(--mono); font-size: 0.75rem; line-height: 1.6; color: var(--muted); }
.dc .refs { font-size: 0.875rem; line-height: 1.5; }
.dc .refs ol { margin: 0; padding-left: 1.5rem; display: flex; flex-direction: column; gap: 0.5rem; }
.dc .refs li { color: var(--muted); }
.dc .refs li::marker { font-family: var(--mono); font-size: 0.75rem; }
.dc a { color: var(--fresh); text-decoration-thickness: 1px; text-underline-offset: 2px; }
.dc a:focus-visible { outline: 2px solid var(--fresh); outline-offset: 3px; }
@media (max-width: 460px) {
  .dc th { width: auto; white-space: normal; }
  .dc table, .dc tbody, .dc tr, .dc th, .dc td { display: block; }
  .dc th { border-bottom: 0; padding-bottom: 0.1rem; }
  .dc td { padding-top: 0; }
}
/* Email gate */
.dc .dc-gate { min-height: 100vh; display: flex; align-items: center; justify-content: center; padding: 2rem 16px; }
.dc .dc-gate-card { width: 100%; max-width: 30rem; }
.dc .dc-gate-title { margin-top: 0.8rem; }
.dc .dc-gate-desc { font-size: 1.15rem; line-height: 1.45; margin: 0.8rem 0 2rem; }
.dc .dc-gate-label { display: block; font-family: var(--mono); font-size: 0.75rem; color: var(--muted); margin-bottom: 0.5rem; }
.dc .dc-gate-row { display: flex; gap: 0.5rem; }
.dc .dc-gate-input { flex: 1; min-width: 0; font: inherit; font-size: 1rem; padding: 0.6rem 0.8rem; border: 1px solid var(--line); border-radius: 3px; background: var(--surface); color: var(--ink); }
.dc .dc-gate-input:focus { outline: 2px solid var(--fresh); outline-offset: 1px; }
.dc .dc-gate-btn { font-family: var(--mono); font-size: 0.85rem; padding: 0.6rem 1.2rem; border: 0; border-radius: 3px; background: var(--ink); color: var(--paper); cursor: pointer; }
.dc .dc-gate-btn:disabled { opacity: 0.6; }
.dc .dc-gate-error { font-family: var(--mono); font-size: 0.75rem; color: var(--spoil); margin-top: 0.6rem; }
.dc .dc-gate-note { font-family: var(--mono); font-size: 0.7rem; color: var(--muted); margin-top: 1.2rem; }
`;

const MONO = 'IBM Plex Mono, monospace';
const BLOOMS: [number, string, number, string][] = [
  [60, '#E8963A', 1, '#C97A24'],
  [170, '#DF8B33', 0.98, '#BE7021'],
  [280, '#CE7D2B', 0.95, '#A9611D'],
  [390, '#B36A26', 0.9, '#8E5019'],
  [500, '#96581F', 0.83, '#744215'],
  [610, '#7A4E24', 0.73, '#5E3A19']
];
const BARS: [number, number, 'fresh' | 'spoil'][] = [
  [20, 77, 'fresh'],
  [130, 74, 'fresh'],
  [240, 67, 'fresh'],
  [350, 56, 'fresh'],
  [460, 38, 'spoil'],
  [570, 18, 'spoil']
];

export function DeCurveDoc() {
  return (
    <div className="wrap">
      <header data-track="Intro">
        <p className="eyebrow">Working document &middot; October 2026</p>
        <h1>DeCurve</h1>
        <p className="tagline">Building a world model for perishable decay.</p>
        <p className="standfirst">
          Every dataset in this field is a photograph. We are building the first one with time in it: outcome-labelled
          decay trajectories under controlled conditions. We fund it by selling allocation decisions to people who lose
          billions to spoilage.
        </p>
      </header>

      <section data-track="The gap">
        <h2>The gap</h2>
        <p>
          Postharvest loss is one of the largest unsolved problems in agriculture. Around a third of what is harvested
          is never eaten. India alone loses roughly 7.4 million tonnes of fruit and 12 million tonnes of vegetables a
          year after harvest. Guava loses 15% of its crop between the farm and the market.<sup>1,2</sup>
        </p>
        <p>
          The largest public dataset for fruit ripeness holds a few thousand lab images across five fruits, each tagged
          unripe, ripe or overripe.<sup>3</sup> But these snapshots miss a crucial element &mdash; the curve of decay,
          which limits everything downstream. It also highlights a key constraint in this research: not only does every
          variety of fruit differ in behaviour, each cultivar varies and the same cultivar across different farms also
          behaves differently.
        </p>
      </section>

      <figure className="figure" data-track="Decay curves figure">
        <div className="figure-scroll">
          <svg
            viewBox="0 0 720 330"
            role="img"
            aria-label="A quality-versus-time chart. Three divergent decay curves run from a shared starting point, representing the same produce under unbroken cold chain, one temperature break, and ambient delay. Three isolated dots labelled unripe, ripe and overripe sit unconnected across the field, representing the snapshot labels that existing datasets record."
          >
            <g stroke="var(--line)" strokeWidth="1">
              <line x1="56" y1="30" x2="600" y2="30" />
              <line x1="56" y1="150" x2="600" y2="150" />
              <line x1="56" y1="270" x2="600" y2="270" />
            </g>
            <g stroke="var(--muted)" strokeWidth="1" opacity="0.55">
              <line x1="56" y1="30" x2="56" y2="270" />
            </g>
            <g fill="var(--muted)" fontFamily={MONO} fontSize="10" textAnchor="end">
              <text x="46" y="34">100</text>
              <text x="46" y="154">50</text>
              <text x="46" y="274">0</text>
            </g>
            <g fill="var(--muted)" fontFamily={MONO} fontSize="10" textAnchor="middle">
              <text x="56" y="290">day 0</text>
              <text x="328" y="290">day 7</text>
              <text x="600" y="290">day 14</text>
            </g>
            <text x="18" y="150" fill="var(--muted)" fontFamily={MONO} fontSize="10" textAnchor="middle" transform="rotate(-90 18 150)">
              % saleable
            </text>
            <text x="328" y="316" fill="var(--muted)" fontFamily={MONO} fontSize="10" textAnchor="middle">
              time since harvest
            </text>
            <g fill="none" strokeWidth="2" strokeLinecap="round">
              <path d="M 56 44 C 200 60, 400 78, 600 96" stroke="var(--fresh)" />
              <path d="M 56 44 C 180 82, 360 142, 600 196" stroke="var(--fresh)" opacity="0.55" />
              <path d="M 56 44 C 140 112, 300 202, 600 258" stroke="var(--spoil)" />
            </g>
            <circle cx="56" cy="44" r="3.5" fill="var(--fresh)" />
            <g fontFamily={MONO} fontSize="10">
              <text x="610" y="99" fill="var(--fresh)">2 °C, intact</text>
              <text x="610" y="199" fill="var(--muted)">one break</text>
              <text x="610" y="261" fill="var(--spoil)">ambient 6 h</text>
            </g>
            <g>
              <circle cx="200" cy="70" r="4.5" fill="var(--paper)" stroke="var(--ink)" strokeWidth="1.5" />
              <circle cx="350" cy="152" r="4.5" fill="var(--paper)" stroke="var(--ink)" strokeWidth="1.5" />
              <circle cx="492" cy="228" r="4.5" fill="var(--paper)" stroke="var(--ink)" strokeWidth="1.5" />
              <g fill="var(--ink)" fontFamily={MONO} fontSize="10" textAnchor="middle">
                <text x="200" y="58">unripe</text>
                <text x="350" y="140">ripe</text>
                <text x="492" y="216">overripe</text>
              </g>
            </g>
          </svg>
        </div>
        <figcaption>
          Hollow points: what today&apos;s datasets record. Unlinked labels, no conditions, no outcome. Lines: the same
          produce under three cold chains. The label is not the information. The path is.
        </figcaption>
      </figure>

      <section data-track="What we are building">
        <h2>What we are building</h2>
        <p>
          Shelf life prediction. One number for one crate, at the moment someone has to decide what to do with it: days
          of saleable life remaining, with a confidence interval.
        </p>
      </section>

      <section data-track="How">
        <h2>How</h2>
        <div className="steps">
          <div className="step">
            <h3>Capture</h3>
            <p>
              A cheap networked imaging node. Commodity single-board hardware, a frame every thirty minutes, temperature
              and humidity alongside. It goes where perishables sit and move: controlled rooms, farms, mandis, auction
              floors, trucks.
            </p>
          </div>
          <div className="step">
            <h3>Process</h3>
            <p>
              Multimodal fusion over imagery, environmental history and cultivar, with decay kinetics built into the
              architecture rather than learned from scratch. Spectroscopy, hyperspectral and electronic-nose sensing in
              the controlled room; cheap commodity sensing in the field. Inference runs at the edge.
            </p>
          </div>
        </div>
      </section>

      <figure className="figure" data-track="Marigold filmstrip">
        <div className="figure-scroll">
          <svg
            viewBox="0 0 720 196"
            role="img"
            aria-label="A six-frame filmstrip showing one marigold bloom over five days. The bloom shrinks and darkens from saturated orange to brown across the frames, with a saleable-quality bar beneath each frame falling from 96 percent to 22 percent."
          >
            <defs>
              <g id="dc-petal">
                <ellipse cx="0" cy="-17" rx="7.5" ry="17" />
              </g>
              <g id="dc-bloom">
                {[0, 45, 90, 135, 180, 225, 270, 315].map(r => (
                  <use key={r} href="#dc-petal" transform={`rotate(${r})`} />
                ))}
                {[22.5, 67.5, 112.5, 157.5, 202.5, 247.5, 292.5, 337.5].map(r => (
                  <use key={r} href="#dc-petal" transform={`rotate(${r}) scale(0.72)`} />
                ))}
              </g>
            </defs>
            {BLOOMS.map(([x, petal, scale, core]) => (
              <g key={x} transform={`translate(${x} 54)`}>
                <g fill={petal}>
                  <use href="#dc-bloom" transform={`scale(${scale})`} />
                </g>
                <circle r="6" fill={core} />
              </g>
            ))}
            <g fill="var(--muted)" fontFamily={MONO} fontSize="10" textAnchor="middle">
              {['t = 0 h', '24 h', '48 h', '72 h', '96 h', '120 h'].map((t, i) => (
                <text key={t} x={60 + i * 110} y="124">
                  {t}
                </text>
              ))}
            </g>
            <g fill="var(--line)">
              {BARS.map(([x]) => (
                <rect key={x} x={x} y="138" width="80" height="6" rx="3" />
              ))}
            </g>
            {BARS.map(([x, w, tone]) => (
              <rect key={`f${x}`} x={x} y="138" width={w} height="6" rx="3" fill={`var(--${tone})`} />
            ))}
            <g fill="var(--muted)" fontFamily={MONO} fontSize="10" textAnchor="middle">
              {['96%', '92%', '84%', '70%', '48%', '22%'].map((t, i) => (
                <text key={t} x={60 + i * 110} y="162">
                  {t}
                </text>
              ))}
            </g>
            <text x="360" y="186" fill="var(--muted)" fontFamily={MONO} fontSize="10" textAnchor="middle">
              one node, one bloom, 240 frames &mdash; six shown
            </text>
          </svg>
        </div>
        <figcaption>
          Schematic of a single node&apos;s output. Frames every thirty minutes, a derived saleable-quality score per
          frame, and a terminal outcome. One trajectory. A warehouse is tens of thousands of these.
        </figcaption>
      </figure>

      <section data-track="What transfers is physics">
        <h2>What transfers is physics</h2>
        <p>
          Quality degradation follows known kinetics. Arrhenius temperature dependence, zero- and first-order decay. The
          functional form is the same for a mango and a marigold; only the parameters differ.<sup>4,5</sup>
        </p>
        <p>
          Build those kinetics into the model and transferring to a new crop stops being a retraining problem and
          becomes a parameter estimation problem. Recent work embedding kinetic knowledge directly in the network
          improves accuracy and, more importantly, extrapolation beyond the observed window.<sup>6</sup> That
          extrapolation is the product. The prediction worth paying for is day ten, made on day two.
        </p>
      </section>

      <section data-track="One crop deep">
        <h2>One crop deep, then measured outward</h2>
        <p>
          Models in this field transfer badly. Spectral quality models need recalibration across cultivars of the same
          fruit, across growing regions, even across seasons.<sup>7,8</sup> Non-climacteric senescence and climacteric
          ripening are different dynamical systems: one declines, the other has an autocatalytic burst. A model trained
          only on decline cannot predict a burst.
        </p>
        <p>
          So depth in one crop is pretraining substrate, not a finished model. Self-supervised pretraining on imagery
          paired with environmental history has held across sites and is built for few-label conditions.<sup>9</sup> The
          next crop should then cost a few hundred labelled trajectories rather than tens of thousands. That is a claim,
          not a result. We will carry two contrast crops from the start at low volume, one near and one far, and report
          the number.
        </p>
      </section>

      <section data-track="Variety is a dimension">
        <h2>Variety is a dimension, not a footnote</h2>
        <p>
          Two crates on the same truck at the same temperature decay differently because they are not the same
          cultivar. Across fourteen carnation varieties, ethylene sensitivity runs the full length of the scale.
          <sup>10</sup> Everyone currently modelling fresh produce treats it as commodity SKUs. Trajectories indexed by
          cultivar sharpen the predictions, and they accumulate into a map from variety to measured decay behaviour that
          breeding programmes have never had, because postharvest life is too expensive for them to measure. That map
          sells on its own, through conventional channels.
        </p>
      </section>

      <section data-track="Why buildable now">
        <h2>Why this is buildable now, and cheaply</h2>
        <p>
          The capture hardware is almost free. A published plant phenotyping network of twenty-eight imaging nodes cost
          about $1,200 in total, imaging every twenty minutes on commodity single-board computers.<sup>11</sup> That is
          the entire v1 rig.
        </p>
        <p>
          I already have the harder half. Through seven years in a puja flower supply chain across nine Indian cities, I
          have farm-to-shelf capture: the growing conditions, the harvest, the cold chain, the retail endpoint, and what
          actually happened to the product. Preharvest conditions are established determinants of postharvest life,
          <sup>12</sup> and almost no dataset links them to outcomes, because the farm and the cold chain belong to
          different people. Running this at real volume in India costs a fraction of what it would anywhere else.
        </p>
        <p>
          The model side has also gotten cheap. Vision foundation models give usable perception from hundreds of
          labelled examples instead of hundreds of thousands.<sup>13</sup> Plant genomic foundation models are open
          weights.<sup>14</sup> Bayesian optimisation turns parameter search into a sample-efficient loop.<sup>15</sup>
        </p>
        <p>
          There are passive feeds to start from before a single node is deployed. Flower auctions already photograph
          lots at scale and attach a clock price, a grower quality score and a complaint record to each one.
          <sup>16</sup> Optical graders in packhouses image every individual fruit and discard the images after sorting.
          <sup>17</sup> Price is a quality label produced by professional buyers, for free.
        </p>
      </section>

      <section data-track="Who pays">
        <h2>Who pays</h2>
        <p>
          Spoilage costs everyone. Willingness to pay concentrates where two parties are arguing about value and money
          moves on the answer.
        </p>
        <div className="table-scroll">
          <table>
            <tbody>
              <tr className="lead">
                <th scope="row">Auctions</th>
                <td>
                  Price discovery in minutes on quality nobody has measured. Royal FloraHolland already runs a grower
                  quality index, a complaints desk and a re-inspection rule under which growers discount after a claim.
                  <sup>16</sup> The arbitration layer exists, it is manual, and it sits on the exact moment a number would
                  change the price. First customer.
                </td>
              </tr>
              <tr>
                <th scope="row">Mandis</th>
                <td>Same moment, no instrumentation anywhere, enormous volume, no competitor.</td>
              </tr>
              <tr>
                <th scope="row">Exporters, packers</th>
                <td>
                  High unit value, live routing calls. Already buy pre-shipment inspection at 0.5&ndash;1.5% of order
                  value.<sup>18</sup>
                </td>
              </tr>
              <tr>
                <th scope="row">Importers</th>
                <td>
                  Bear rejection risk and allocate the same morning. Disputes already settle on inspection certificates.
                  <sup>19</sup>
                </td>
              </tr>
              <tr>
                <th scope="row">Growers</th>
                <td>Which cultivar to plant for which route. Breeders will pay for the characterisation.</td>
              </tr>
              <tr className="later">
                <th scope="row">Grocers</th>
                <td>
                  Largest budgets, longest sales cycles, incumbents already inside. Right customer, wrong first customer.
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <section data-track="Who I am looking for">
        <h2>Who I am looking for</h2>
        <p style={{ color: 'var(--muted)', fontSize: '0.975rem', marginBottom: '1.4rem' }}>
          A cofounder to iterate on this with, fast.
        </p>
        <div className="roles">
          <div className="role">
            <h3>A thinking partner who can run a business</h3>
            <p>
              Someone who understands this space broadly and can navigate the parts that are not the science: selling
              it, distributing the apparatus, changing direction as data comes in. I have run shelf life studies myself
              and I know the technical team we need to hire. What I want is someone to build the company with.
            </p>
          </div>
          <div className="role">
            <h3>Useful, not required</h3>
            <p>
              Postharvest physiology. Sensing and machine learning. Experience selling into packers, exporters, auctions
              or mandis.
            </p>
          </div>
        </div>
      </section>

      <hr className="rule" />

      <section className="contact" data-track="Get in touch">
        <p className="eyebrow">Get in touch</p>
        <p style={{ margin: 0 }}>
          This is a working document. I want to work with someone who wants to test it fast and decide where to go from
          what we learn, rather than theorise endlessly.
        </p>
        <p className="addr">
          <a href="mailto:rhea@rosebazaar.in">rhea@rosebazaar.in</a>
        </p>
        <p className="note">Rhea Karuturi &middot; San Francisco and Bangalore</p>
      </section>

      <hr className="rule" />

      <section className="refs" data-track="References">
        <h2>References</h2>
        <ol>
          {REFS.map(([href, label]) => (
            <li key={href}>
              <a href={href} target="_blank" rel="noreferrer">
                {label}
              </a>
            </li>
          ))}
        </ol>
      </section>
    </div>
  );
}

const REFS: [string, string][] = [
  ['https://eparlib.sansad.in/bitstream/123456789/3017416/1/AU1976_37fxUw.pdf', 'Ministry of Food Processing Industries, post-harvest loss figures (NABCONS study), Lok Sabha reply, 2025'],
  ['https://www.global-agriculture.com/india-region/indias-highest-post-harvest-losses-guava-and-tomato-among-the-worst-hit/', 'NABCONS study on post-harvest losses across 54 Indian commodities, 2020–22'],
  ['https://arxiv.org/html/2608.01202', 'DeepHS Fruit: the largest public hyperspectral dataset for fruit ripeness'],
  ['https://pmc.ncbi.nlm.nih.gov/articles/PMC13361796/', 'Quality deterioration kinetics and Arrhenius-based shelf-life prediction'],
  ['https://www.sciencedirect.com/science/article/abs/pii/S002364382031598X', 'Kinetic models applied to quality change and shelf-life prediction in kiwifruit'],
  ['https://research.wur.nl/en/publications/a-generic-scientific-machine-learning-framework-for-fruit-and-veg/', 'A generic scientific machine learning framework for fruit and vegetable quality prediction, Wageningen'],
  ['https://www.sciencedirect.com/science/article/abs/pii/S0925521425001061', 'Domain-adversarial transfer of apple soluble-solids models across cultivars'],
  ['https://www.sciencedirect.com/science/article/abs/pii/S0889157524000620', 'Model transfer for apple ripeness under seasonal variation'],
  ['https://www.mdpi.com/2073-4395/16/15/1478', 'Self-supervised multimodal learning across preharvest images and environmental sensors'],
  ['https://maxapress.com/article/id/659f6488fa6c582fb805960d', 'Ethylene sensitivity and vase life across fourteen carnation varieties'],
  ['https://www.mdpi.com/2077-0472/13/10/1874', 'A low-cost camera network for high-throughput plant phenotyping'],
  ['https://www.intechopen.com/chapters/87184', 'Pre-harvest and postharvest factors affecting quality and shelf life'],
  ['https://arxiv.org/pdf/2603.02419', 'DINOv3 visual representations for horticultural perception'],
  ['https://pubmed.ncbi.nlm.nih.gov/42567165/', 'PlantCAD2: a DNA foundation model across flowering plants'],
  ['https://www.nature.com/articles/s41467-025-61113-5', 'Bayesian optimisation for iterative experimental design'],
  ['https://royalfloraholland.com/en/buying/simplified-dealmaking/certainty-about-your-purchases', 'Royal FloraHolland: quality index, lot photography and complaints'],
  ['https://www.foodengineeringmag.com/articles/101636-tomra-food-introduces-ai-powered-fruit-sorting-and-grading-solutions', 'AI-powered optical sorting and grading in packhouses'],
  ['https://seller.alibaba.com/blogs/2026/southeast-asia/dried-fruit/third-party-inspection-30-day-return-buyer-protection-guide-alibaba-b2b', 'Pre-shipment inspection pricing in agri-commodity trade'],
  ['https://fvdrc.com/solutions/arbitration-decision-brief-20579/', 'Produce dispute arbitration decided on inspection certificate']
];

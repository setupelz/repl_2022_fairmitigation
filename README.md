# Replication archive for: "Fairness considerations in global mitigation investments", S. Pachauri et al., Science (2022), doi:10.1126/science.adf0067

Title: Fairness considerations in global mitigation investments

Authors: Shonali Pachauri1, Setu Pelz1, Christoph Bertram2, Silvie Kreibiehl3, Narasimha D. Rao1,4, Keywan Riahi1, Youba Sokona5,6

Affiliations: 1International Institute for Applied Systems Analysis, 2Potsdam Institute for Climate Impact Research, 3Germanwatch e.V., 4Yale School of the Environment, 5South Centre, 6University College London	

Publication: https://science.org/doi/10.1126/science.adf0067

Publication replication archive (citeable): https://doi.org/10.5281/zenodo.7308573

## Interactive explorer

`site/` is the fair mitigation finance explorer that accompanies the paper
(originally the 2022 Shiny app at pelz.shinyapps.io/fairinvestmentexplorer,
rebuilt as a static page). It is published at https://setupelz.com/fairfinance/
from this archive. All arithmetic (weight normalisation, fair-share allocation,
the within- and inter-regional split) runs in the browser in
`site/assets/app.js`; the inputs are the three CSVs in `Data/explorer/`
(indicator values, indicator-derived regional shares with the AR6 TS.25
investment-need bounds and recent investment, and 2019 population and GDP),
converted to `site/assets/data.js` by `Code/build_explorer_data.py`. Highcharts
is bundled under `site/assets/vendor/` and used under its non-commercial
licence. Local preview: `cd site && python3 -m http.server`.

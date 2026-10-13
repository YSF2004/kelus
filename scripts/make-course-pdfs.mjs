// Regenerates tests/fixtures/course-pdfs: node scripts/make-course-pdfs.mjs tests/fixtures/course-pdfs
import { chromium } from "playwright";
const out = process.argv[2];
const css = `body{font-family:Georgia,serif;font-size:11pt;line-height:1.45;margin:0}h1{font-family:Helvetica,Arial;font-size:20pt}h2{font-family:Helvetica,Arial;font-size:14pt;margin-top:18pt}p{text-align:justify;hyphens:auto}`;
const docs = {
  "econ-lecture-4-elasticity.pdf": { landscape: true, header: "", footer: `<div style="font-size:8pt;width:100%;padding:0 40px;display:flex;justify-content:space-between;color:#777"><span>Intro Economics · Week 4</span><span class="pageNumber"></span></div>`, html: `<style>${css}.s{height:100vh;box-sizing:border-box;padding:40px 60px;page-break-after:always;font-family:Helvetica,Arial}.s h1{font-size:28pt}.s li{font-size:16pt;margin:8pt 0}</style>
<div class="s"><h1>Lecture 4: Elasticity</h1><p style="font-size:16pt">Intro Economics · Week 4</p></div>
<div class="s"><h1>Learning objectives</h1><ul><li>Define price elasticity of demand</li><li>Calculate elasticity from a price change</li><li>Explain what makes demand elastic or inelastic</li></ul></div>
<div class="s"><h1>Price elasticity of demand</h1><ul><li>Price elasticity of demand measures how much the quantity demanded responds to a change in price.</li><li>PED = % change in quantity demanded ÷ % change in price</li><li>If PED is greater than 1, demand is elastic: quantity falls by more than price rises.</li><li>If PED is less than 1, demand is inelastic: total revenue rises when price rises.</li></ul></div>
<div class="s"><h1>Determinants of elasticity</h1><ul><li>Close substitutes make demand more elastic, because buyers can switch easily.</li><li>Necessities such as insulin have inelastic demand.</li><li>Demand becomes more elastic over a longer time period.</li><li>A good that takes a large share of income has more elastic demand.</li></ul></div>
<div class="s"><h1>Income elasticity of demand</h1><ul><li>Income elasticity measures how quantity demanded responds to a change in consumer income.</li><li>Normal goods have positive income elasticity; inferior goods have negative income elasticity.</li><li>Luxury goods have income elasticity greater than 1.</li></ul></div>
<div class="s"><h1>Cross-price elasticity</h1><ul><li>Cross-price elasticity measures how demand for one good responds to the price of another good.</li><li>Substitutes have positive cross-price elasticity; complements such as printers and ink have negative cross-price elasticity.</li></ul></div>
<div class="s"><h1>Summary</h1><ul><li>Elasticity tells firms how revenue changes when they change price.</li><li>Next week: tax incidence and who bears the burden of a tax.</li></ul></div>` },
  "biology-ch7-cell-transport.pdf": { header: `<div style="font-size:8pt;width:100%;padding:0 60px;color:#777;font-style:italic">Chapter 7 · Cell Transport</div>`, footer: `<div style="font-size:8pt;width:100%;text-align:center;color:#777"><span class="pageNumber"></span></div>`, html: `<style>${css}body{padding:0 10px}</style>
<h1>7 Cell Transport</h1>
<p>Every cell must exchange substances with its surroundings. Oxygen and glucose must enter, and carbon dioxide and urea must leave. The cell surface membrane controls this exchange because it is partially permeable: it lets some molecules through and blocks others. This chapter describes the three main ways substances cross the membrane.</p>
<h2>7.1 Diffusion</h2>
<p>Diffusion is the net movement of particles from a region of higher concentration to a region of lower concentration, down a concentration gradient. It is a passive process, so it needs no energy from respiration. The rate of diffusion increases when the concentration gradient is steeper, when the temperature is higher and when the surface area is larger. Alveoli in the lungs and villi in the small intestine have a very large surface area, which makes diffusion fast.</p>
<p><b>Figure 7.1</b> Oxygen diffuses from the alveolus into the blood because its concentration is higher in the air.</p>
<h2>7.2 Osmosis</h2>
<p>Osmosis is the net movement of water molecules from a dilute solution to a more concentrated solution through a partially permeable membrane. In a hypotonic solution a plant cell gains water and becomes turgid, because the cell wall pushes back against the swelling vacuole. In a hypertonic solution the cell loses water by osmosis, the vacuole shrinks and the membrane pulls away from the cell wall; the cell is plasmolysed. Animal cells have no cell wall, so in a hypotonic solution a red blood cell swells and may burst.</p>
<h2>7.3 Active transport</h2>
<p>Active transport moves substances against a concentration gradient, from a lower concentration to a higher concentration. It needs energy from respiration and carrier proteins in the membrane. Root hair cells use active transport to absorb mineral ions from the soil, where the concentration of ions is lower than inside the cell. Cells that carry out active transport contain many mitochondria to release the energy needed.</p>
<h2>Key terms</h2>
<p>concentration gradient · partially permeable membrane · turgid · plasmolysed · carrier protein</p>` },
  "history-causes-ww1-handout.pdf": { header: "", footer: `<div style="font-size:8pt;width:100%;text-align:right;padding:0 40px;color:#777">History revision handout · page <span class="pageNumber"></span></div>`, html: `<style>${css}.cols{column-count:2;column-gap:24pt}</style>
<h1>The causes of the First World War</h1>
<div class="cols">
<h2>Militarism</h2><p>Before 1914 the great powers built up their armies and navies. The naval race between Britain and Germany after 1906, when Britain launched the Dreadnought, increased suspicion between the two countries. Military plans such as the Schlieffen Plan meant that a war in one place would quickly spread.</p>
<h2>Alliances</h2><p>Europe was divided into two armed camps. The Triple Alliance joined Germany, Austria-Hungary and Italy. The Triple Entente joined Britain, France and Russia. Because each country promised to defend its allies, a local conflict could drag the whole continent into war.</p>
<h2>Imperialism</h2><p>The powers competed for colonies in Africa and Asia. The Moroccan crises of 1905 and 1911 showed that Germany wanted a larger empire and pushed Britain and France closer together.</p>
<h2>Nationalism</h2><p>Nationalism made people believe their nation was superior. In the Balkans, Slav nationalism threatened Austria-Hungary. Serbia wanted to unite the Slav peoples, and the Black Hand group used violence to achieve it.</p>
<h2>The assassination at Sarajevo</h2><p>On 28 June 1914 Gavrilo Princip shot Archduke Franz Ferdinand in Sarajevo. Austria-Hungary blamed Serbia and declared war on 28 July. Russia mobilised to support Serbia, Germany declared war on Russia and France, and Britain entered the war when Germany invaded Belgium.</p>
</div>` },
  "fiche-photosynthese.pdf": { header: "", footer: "", html: `<style>${css}table{border-collapse:collapse;width:100%}td,th{border:1px solid #999;padding:4pt;font-size:10pt;text-align:left}</style>
<h1>Fiche de révision — La photosynthèse</h1>
<h2>Définition</h2><p>La photosynthèse est la réaction par laquelle les plantes vertes fabriquent du glucose à partir du dioxyde de carbone et de l'eau, en utilisant l'énergie lumineuse captée par la chlorophylle. Elle libère du dioxygène.</p>
<h2>Où a-t-elle lieu ?</h2><p>Elle se déroule dans les chloroplastes des cellules des feuilles. Les stomates laissent entrer le dioxyde de carbone, et les racines absorbent l'eau du sol.</p>
<h2>Facteurs limitants</h2><table><tr><th>Facteur</th><th>Effet</th></tr><tr><td>Intensité lumineuse</td><td>Plus la lumière est forte, plus la photosynthèse est rapide, jusqu'à un plateau.</td></tr><tr><td>Concentration en CO₂</td><td>Une concentration plus élevée augmente la vitesse de la réaction.</td></tr><tr><td>Température</td><td>Au-delà de 40 °C les enzymes sont dénaturées et la vitesse diminue.</td></tr></table>
<h2>Équation bilan</h2><p>6 CO₂ + 6 H₂O → C₆H₁₂O₆ + 6 O₂, en présence de lumière et de chlorophylle.</p>` },
};
const browser = await chromium.launch();
const page = await browser.newPage();
for (const [name, doc] of Object.entries(docs)) {
  await page.setContent(`<html lang="${name.startsWith("fiche") ? "fr" : "en"}"><body>${doc.html}</body></html>`);
  await page.pdf({ path: `${out}/${name}`, format: "A4", landscape: Boolean(doc.landscape), displayHeaderFooter: Boolean(doc.header || doc.footer), headerTemplate: doc.header || "<span></span>", footerTemplate: doc.footer || "<span></span>", margin: { top: "50px", bottom: "50px", left: "50px", right: "50px" } });
  console.log("made", name);
}
await browser.close();

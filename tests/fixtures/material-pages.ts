import type { ExtractedMaterialLine, ExtractedMaterialPage } from "../../domain/types";

function line(text: string, y: number, fontSize: number, paragraphBreakBefore = false): ExtractedMaterialLine {
  return { text, x: 72, y, width: text.length * fontSize * 0.48, fontSize, paragraphBreakBefore };
}

export const MATERIAL_PAGE_FIXTURES: Record<string, ExtractedMaterialPage[]> = {
  biology: [{
    pageNumber: 3,
    text: "CELLULAR RESPIRATION\nCells transfer energy from glucose into ATP.\nThe process includes glycolysis, the citric acid cycle, and oxidative phosphorylation.\n\nElectron transport chain\nElectrons move through membrane proteins and create the proton gradient used by ATP synthase.",
    lines: [
      line("CELLULAR RESPIRATION", 720, 21, true),
      line("Cells transfer energy from glucose into ATP.", 684, 11),
      line("The process includes glycolysis, the citric acid cycle, and oxidative phosphorylation.", 666, 11),
      line("Electron transport chain", 612, 18, true),
      line("Electrons move through membrane proteins and create the proton gradient used by ATP synthase.", 582, 11),
    ],
  }],
  computerScience: [{
    pageNumber: 8,
    text: "Hash tables\nA hash table stores key-value pairs by converting each key into an array position.\nCollisions require a strategy such as chaining or open addressing.\n\nGraph traversal\nBreadth-first search explores neighbors by level, while depth-first search follows one path before backtracking.",
    lines: [
      line("Hash tables", 720, 17, true),
      line("A hash table stores key-value pairs by converting each key into an array position.", 690, 11),
      line("Collisions require a strategy such as chaining or open addressing.", 672, 11),
      line("Graph traversal", 618, 17, true),
      line("Breadth-first search explores neighbors by level, while depth-first search follows one path before backtracking.", 588, 11),
    ],
  }],
  history: [{
    pageNumber: 4,
    text: "Week 4: Industrialization and Urban Life\nFactories changed where people worked and accelerated migration into industrial cities.\n\nLabor Movements\nWorkers formed unions to bargain collectively over wages, hours, and workplace safety.",
  }],
  law: [{
    pageNumber: 12,
    text: "THE DOCTRINE OF CONSIDERATION\nA promise is generally enforceable when it is exchanged for legally sufficient value.\n\nPromissory Estoppel\nA court may enforce a promise when reasonable reliance produced a substantial detriment.",
  }],
  mathematics: [{
    pageNumber: 6,
    text: "Problem Set 6\nComplete questions one through eight before Friday.\n\nThe Extreme Value Theorem\nA continuous function on a closed interval attains both an absolute maximum and an absolute minimum.",
    lines: [
      line("Problem Set 6", 720, 18, true),
      line("Complete questions one through eight before Friday.", 690, 11),
      line("The Extreme Value Theorem", 630, 18, true),
      line("A continuous function on a closed interval attains both an absolute maximum and an absolute minimum.", 600, 11),
    ],
  }],
};

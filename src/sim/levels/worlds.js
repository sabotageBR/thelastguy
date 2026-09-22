// Os 5 mundos e suas 4 fases (Corrida, Corrida, Sobrevivência, Final).
export const WORLDS = [
  { id: 'ceu', name: 'Céu Doce', tagline: 'Um circuito de doces flutuando no céu', phases: ['ceu-1', 'ceu-2', 'ceu-3', 'ceu-4'] },
  { id: 'gelo', name: 'Reino Gelado', tagline: 'Gelo escorregadio, aurora e pingentes', phases: ['gelo-1', 'gelo-2', 'gelo-3', 'gelo-4'] },
  { id: 'vulcao', name: 'Vulcão', tagline: 'Corrida sobre um mar de lava', phases: ['vulc-1', 'vulc-2', 'vulc-3', 'vulc-4'] },
  { id: 'selva', name: 'Templo da Selva', tagline: 'Armadilhas antigas, troncos e um rio', phases: ['selva-1', 'selva-2', 'selva-3', 'selva-4'] },
  { id: 'espaco', name: 'Estação Espacial', tagline: 'Gravidade baixa, lasers e um buraco negro', phases: ['esp-1', 'esp-2', 'esp-3', 'esp-4'] },
];

export const SLOT_TYPES = ['race', 'race', 'survival', 'final'];
export const SLOT_LABEL = { race: 'Corrida', survival: 'Sobrevivência', final: 'Final' };

export function worldById(id) {
  return WORLDS.find((w) => w.id === id) || WORLDS[0];
}

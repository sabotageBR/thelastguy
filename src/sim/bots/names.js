// Apelidos dos bots no estilo gamer BR (docs/design/conteudo.md §7).
import { Rng, hash32 } from '../../core/rng.js';

export const BOT_NAMES = [
  'xX_Pedrin_Xx', 'Lukinhas2011', 'BRZ_Maromba', 'DuduGamer_BR', 'Kauan_PvP', 'AnaClara07', 'Nicolas_Top1', 'JoaoVitor_XD',
  'Tio_Bolinha', 'Vitinho_Monstro', 'GabiGameplay', 'Rafa_Noob123', 'Bruninha_', 'Ze_Da_Manga', 'Enzo_Bala', 'Gordin_Veloz',
  'LeoZika', 'Mc_Pulinho', 'PiuPiu_BR', 'Sr_Coxinha', 'PaoDeQueijo99', 'Brigadeiro_Fofo', 'Tatu_Bolinha', 'CapivaraRage',
  'Julinha_Kawaii', 'Matheus_BR', 'Thiagao_PRO', 'Lipe_Tryhard', 'Duda_OP', 'Kaio.exe', 'Yasmin_Sz', 'Sofia_Sz2',
  'Arthur_GG', 'Heitor_1v1', 'Tropeco_Master', 'UltimoDePe', 'BRabo_Games', 'Fominha_BR', 'Pastel_De_Vento', 'Acai_Com_Granola',
  'Mandioca_Frita', 'Guarana_Gelado', 'Jacare_Voador', 'Sabia_Laranjeira', 'Macaquinho_BR', 'Tucano_Turbo', 'Onca77', 'Saci_XD',
  'Curupira_Pro', 'Boitata_Fire', 'Bolacha_Ou_Biscoito', 'Chimarrao_RS', 'CariocaDoGrau', 'Mineirinho_Uai', 'Baiano_Relax',
  'Paulistinha_SP', 'Nordestino_Raiz', 'Frevo_Recife', 'Miguelzin_777', 'Bela_Tropeca',
];

/** n nomes distintos sorteados com semente. */
export function pickNames(seed, n) {
  const r = new Rng(hash32(seed, 'names'));
  return r.shuffle([...BOT_NAMES]).slice(0, n);
}

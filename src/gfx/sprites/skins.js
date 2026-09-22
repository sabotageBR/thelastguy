// As 20 skins (docs/design/conteudo.md, seção 6). Sombras são derivadas automaticamente.

export const SKIN_TONES = {
  S1: '#f9d3b4',
  S2: '#e8b48f',
  S3: '#c68b5e',
  S4: '#8d5a3b',
  S5: '#5e3a26',
};

// hat: chave de HATS; hair: chave de HAIR; print: estampa da camisa; acc: acessórios.
export const SKINS = [
  { id: 'beto', name: 'Beto Boné', tone: 'S2', hat: 'cap', hair: 'short', colors: { hat: '#e32a31', hatAccent: '#9e1b2a', hair: '#5a3222', shirt: '#e32a31', pants: '#2e5fd6', shoes: '#f2f2f2' } },
  { id: 'guga', name: 'Guga Verde', tone: 'S3', hat: 'cap', hair: 'short', print: 'skull', colors: { hat: '#3daa3a', hatAccent: '#23702a', hair: '#2b1a12', shirt: '#6b4a2e', pants: '#7a5230', shoes: '#3b2a2a' } },
  { id: 'duda', name: 'Duda Azul', tone: 'S2', hat: 'cap', hair: 'short', colors: { hat: '#2a62d6', hatAccent: '#173f95', hair: '#4a2a18', shirt: '#f4f4f4', pants: '#23345e', shoes: '#3b2a2a' } },
  { id: 'tonho', name: 'Xerife Tonho', tone: 'S3', hat: 'cowboy', hair: 'short', acc: ['bandana'], colors: { hat: '#8a5a2e', hair: '#3a2416', shirt: '#d8342c', pants: '#3a64c4', shoes: '#5a3a20', accent: '#d42a2a' } },
  { id: 'olaf', name: 'Olaf Viking', tone: 'S1', hat: 'viking', hair: 'short', acc: ['beard'], colors: { hat: '#8c97a6', hair: '#d9772b', shirt: '#243a6b', pants: '#232323', shoes: '#4a3020' } },
  { id: 'juca', name: 'Chef Juca', tone: 'S3', hat: 'chef', hair: 'short', print: 'chef', acc: ['moustache'], colors: { hat: '#ffffff', hair: '#2b1a12', shirt: '#f4f4f4', pants: '#6b4a2e', shoes: '#2b2b2b' } },
  { id: 'pipoca', name: 'Panda Pipoca', tone: 'S1', hat: 'panda', hair: 'none', print: 'suit', colors: { hat: '#ffffff', hair: '#111111', shirt: '#1d1d1d', pants: '#1d1d1d', shoes: '#1d1d1d' } },
  { id: 'rosa', name: 'Rosa Punk', tone: 'S1', hat: 'none', hair: 'long', colors: { hair: '#e0408a', shirt: '#1f1f24', pants: '#2a3350', shoes: '#f2f2f2', accent: '#e0408a' } },
  { id: 'nico', name: 'Nico Boné Preto', tone: 'S4', hat: 'capBack', hair: 'short', print: 'hoodie', acc: ['earbud'], colors: { hat: '#1f1f24', hatAccent: '#101014', hair: '#1a100a', shirt: '#2a2a30', pants: '#23345e', shoes: '#f2f2f2' } },
  { id: 'teo', name: 'Téo Gorro', tone: 'S2', hat: 'beanie', hair: 'short', colors: { hat: '#f4f4f4', hatAccent: '#c9d1dc', hair: '#6b3a1e', shirt: '#a9c9f0', pants: '#33384a', shoes: '#3b2a2a' } },
  { id: 'gui', name: 'Gui Loiro', tone: 'S1', hat: 'none', hair: 'spiky', colors: { hair: '#f2c94c', shirt: '#1f1f24', pants: '#3a64c4', shoes: '#f2f2f2' } },
  { id: 'zeca', name: 'Zeca Capacete', tone: 'S5', hat: 'hardhat', hair: 'short', print: 'vest', colors: { hat: '#ffd23f', hatAccent: '#e0a800', hair: '#1a100a', shirt: '#f07c1a', pants: '#3a64c4', shoes: '#5a3a20' } },
  { id: 'kaio', name: 'Kaio Astronauta', tone: 'S3', hat: 'astronaut', hair: 'none', acc: ['tank'], colors: { hat: '#ffffff', hair: '#1a100a', shirt: '#f4f4f4', pants: '#e6e9ee', shoes: '#8a95a8' } },
  { id: 'pingo', name: 'Pingo Pinguim', tone: 'S1', hat: 'penguin', hair: 'none', print: 'suit', colors: { hat: '#1d1d24', hair: '#111111', shirt: '#1d1d24', pants: '#1d1d24', shoes: '#f39a1a' } },
  { id: 'nina', name: 'Nina Ninja', tone: 'S2', hat: 'ninja', hair: 'bun', colors: { hat: '#d42a2a', hair: '#161616', shirt: '#1d1d24', pants: '#1d1d24', shoes: '#111111' } },
  { id: 'barba', name: 'Capitão Barba', tone: 'S3', hat: 'tricorn', hair: 'short', print: 'stripes', acc: ['eyepatch', 'beard'], colors: { hat: '#1d1d24', hair: '#3a2416', shirt: '#d42a2a', pants: '#6b4a2e', shoes: '#2b2b2b' } },
  { id: 'rex', name: 'Rex Dino', tone: 'S2', hat: 'dino', hair: 'none', acc: ['tail'], colors: { hat: '#47b84a', hair: '#1a100a', shirt: '#47b84a', pants: '#3a9a3e', shoes: '#2e7a32' } },
  { id: 'bia', name: 'Bia Bombeira', tone: 'S4', hat: 'firefighter', hair: 'short', print: 'firefighter', colors: { hat: '#d42a2a', hatAccent: '#9a1a1a', hair: '#1a100a', shirt: '#c9a06a', pants: '#b08a58', shoes: '#2b2b2b' } },
  { id: 'indi', name: 'Indi Explorador', tone: 'S2', hat: 'safari', hair: 'short', acc: ['backpack'], colors: { hat: '#d8c28a', hatAccent: '#7a5a2e', hair: '#5a3222', shirt: '#c8b27a', pants: '#7a5230', shoes: '#4a3020', accent: '#7a5a2e' } },
  { id: 'bip', name: 'Bip Robô', tone: 'S1', hat: 'robot', hair: 'none', print: 'robot', colors: { hat: '#aeb9cb', hair: '#111111', shirt: '#9aa5b8', pants: '#7a8598', shoes: '#566279' } },
];

export const SKIN_INDEX = Object.fromEntries(SKINS.map((s, i) => [s.id, i]));

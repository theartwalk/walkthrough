/*
  Sample works for the demo. The artists and works are fictional; the
  images are drawn in the browser so the demo needs no photos.
  A real gallery's works come from its Google Sheet instead (see README).
  Sizes are in centimetres, prices in rupees. price: null = price on request.
*/
window.SAMPLE_WORKS = [
  { id: 'w1', title: 'Monsoon Ledger', artist: 'Ira Malhotra', year: 2025, medium: 'Oil on canvas', w: 120, h: 150, price: 480000, status: 'available',
    note: 'Three bands of indigo laid in thin glazes over six weeks of rain. The top band is the only one painted in daylight.',
    art: { kind: 'field', seed: 11, palette: ['#E6E0D2', '#2C3A7E', '#1F2858', '#3F4E9A'] } },
  { id: 'w2', title: 'Courtyard, Noon', artist: 'Kabir Sethi', year: 2024, medium: 'Gouache on handmade paper', w: 56, h: 76, price: 145000, status: 'available',
    note: 'From a series of courtyards drawn from memory. The arches repeat the shape of the doorway the artist grew up beside.',
    art: { kind: 'arch', seed: 23, palette: ['#F1E6CF', '#C5562F', '#E3B04B', '#7A3B26'] } },
  { id: 'w3', title: 'Bindu IV', artist: 'Noor Qureshi', year: 2025, medium: 'Acrylic on canvas', w: 100, h: 100, price: 320000, status: 'reserved',
    note: 'A single point held at the centre of nine rings. The ochre is ground from earth collected near the artist’s studio in Baroda.',
    art: { kind: 'bindu', seed: 5, palette: ['#E9DFC8', '#B8862F', '#6E3B1F', '#E9DFC8', '#1E1A16'] } },
  { id: 'w4', title: 'Ruled Water', artist: 'Devika Rao', year: 2023, medium: 'Ink on paper', w: 45, h: 60, price: 68000, status: 'available',
    note: 'Drawn in one sitting with a bamboo pen. Each line follows the one above it, so small wobbles travel down the sheet.',
    art: { kind: 'lines', seed: 41, palette: ['#F3F0E8', '#1D2A44', '#33507A', '#0F1520'] } },
  { id: 'w5', title: 'Sixteen Rooms', artist: 'Arjun Pillai', year: 2024, medium: 'Acrylic on board', w: 90, h: 120, price: 260000, status: 'sold',
    note: 'A floor plan of a house in Kochi that no longer stands, one rectangle per room, coloured by what the family remembers of each.',
    art: { kind: 'grid', seed: 77, palette: ['#ECE7DD', '#2F6F64', '#D9A441', '#A8432F', '#283A5B'] } },
  { id: 'w6', title: 'After the Heat', artist: 'Meher Bhatt', year: 2025, medium: 'Oil on linen', w: 200, h: 150, price: null, status: 'available',
    note: 'The largest work in the show. Two soft fields of rose and ash meet along a line that is never quite straight.',
    art: { kind: 'field', seed: 92, palette: ['#E8DCD3', '#C98C86', '#7B6E6A', '#B07A72'] } },
  { id: 'w7', title: 'Small Arch, Blue', artist: 'Kabir Sethi', year: 2025, medium: 'Gouache on paper', w: 30, h: 40, price: 48000, status: 'available',
    note: 'A study for the larger courtyard paintings, kept by the artist until this show.',
    art: { kind: 'arch', seed: 8, palette: ['#E4E7EA', '#2D4F8A', '#9DB4D3', '#18294A'] } },
  { id: 'w8', title: 'Tide Table', artist: 'Tanvi Joshi', year: 2024, medium: 'Pencil and ink on paper', w: 75, h: 100, price: 115000, status: 'available',
    note: 'Six months of tide times at Versova beach, drawn as lines whose spacing follows the water.',
    art: { kind: 'lines', seed: 63, palette: ['#F2EEE6', '#5A4632', '#9C7B55', '#2A2018'] } },
  { id: 'w9', title: 'Census of Windows', artist: 'Rohan Dasgupta', year: 2023, medium: 'Oil on canvas', w: 150, h: 100, price: 390000, status: 'available',
    note: 'Every window on one street in north Kolkata, painted as a block of colour at the hour it was first seen lit.',
    art: { kind: 'grid', seed: 19, palette: ['#E7E1D4', '#C0392B', '#E2B33C', '#1E3D59', '#F1E9D8'] } },
  { id: 'w10', title: 'Saffron Hours', artist: 'Ira Malhotra', year: 2025, medium: 'Oil on canvas', w: 60, h: 60, price: 175000, status: 'available',
    note: 'A small companion to Monsoon Ledger, painted in the dry months that followed.',
    art: { kind: 'bindu', seed: 31, palette: ['#F0E2C4', '#E39B2D', '#B4531E', '#F0E2C4', '#5C2A12'] } }
];

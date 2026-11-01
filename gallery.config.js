/*
  One file per gallery. Copy this repo, change these values, deploy.

  sheetCsvUrl: In Google Sheets choose File > Share > Publish to web,
  pick the artworks tab and "Comma-separated values (.csv)", then paste
  the link here. Leave it empty to show the sample works.
  Column names the Sheet needs are listed in README.md.
*/
window.GALLERY = {
  slug: 'demo',
  name: 'Demo Gallery',
  city: 'New Delhi',
  address: 'Ground floor, 12 Example Road, New Delhi',
  whatsapp: '',            // international format, digits only, e.g. '919876543210'
  email: 'hello@example.com',
  instagram: 'theartwalk.in',
  sheetCsvUrl: '',
  exhibition: {
    title: 'Quiet Geometry',
    dates: 'On view 14 November to 20 December 2026',
    lede: 'Ten works on paper and canvas that slow the eye down: bands of colour, ruled lines, arches and circles, by eight artists working between Delhi, Baroda and Chennai.'
  }
};

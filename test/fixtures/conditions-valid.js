export default [
  // literals as bare truthy conditions
  'true',
  'false',
  'null',
  '42',
  "'available'",

  // runtime expression as bare truthy condition
  '$statusCode',
  '$response.body.active',
  '$steps.foo.outputs.flag',

  // comparisons
  '$statusCode == 200',
  '$statusCode != 200',
  '$statusCode >= 200',
  '$statusCode <= 599',
  '$statusCode > 199',
  '$statusCode < 600',
  "$response.body.status == 'available'",
  '$response.body.count == 0',
  '$response.body.data != null',

  // navigation (property de-reference + index)
  '$response.body.data[0].id > 10',
  '$response.body.items[2] == null',

  // string literal with doubled-quote escape
  "$inputs.name == 'it''s ok'",

  // logical composition
  '$statusCode == 200 && $response.body.data != null',
  '$statusCode == 200 || $statusCode == 201',
  '$statusCode >= 200 && $statusCode < 300',
  '!$response.body.active',
  '!($statusCode == 200)',
  '($statusCode == 200 || $statusCode == 201) && $response.body != null',

  // whitespace tolerance
  '  $statusCode==200  ',

  // number formats
  '$response.body.amount == -3.14',
  '$response.body.amount == 1.5e3',

  // various runtime expression families
  '$url == null',
  '$method == null',
  '$self == null',
  '$request.header.content-type == null',
  '$request.query.limit == 10',
  '$request.path.id == 5',
  '$request.body#/id == 1',
  '$inputs.limit == 10',
  '$outputs.token != null',
  '$workflows.foo.outputs.bar == null',
  '$sourceDescriptions.pet.getPet == null',
  '$components.parameters.foo == null',
];

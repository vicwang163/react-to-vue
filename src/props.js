// valid types that can be transformed to Vue types
let validTypes = {
  array: 'Array',
  bool: 'Boolean',
  func: 'Function',
  number: 'Number',
  object: 'Object',
  string: 'String',
  symbol: 'Symbol'
}

module.exports = function (node) {
  let result = null
  if (node.left.type === 'MemberExpression') { 
    // prop-types
    if (node.left.property.name === 'propTypes') {
      result = {
        'class': node.left.object.name,
        'type': 'propTypes',
        'value': {},
        'caveats': []
      }
      let properties = node.right.properties
      for (let i = 0; i < properties.length; i++) {
        let property = properties[i]
        let value = property.value.property.name
        if (property.value.property && (value === 'isRequired' || validTypes[value])) {
          // case: propTypes.string.isRequired
          if (value === 'isRequired') {
            result.value[property.key.name] = {
              type: validTypes[property.value.object.property.name],
              required: true
            }
          } else {
            result.value[property.key.name] = {
              type: validTypes[value]
            }
          }
        } else {
          result.caveats.push(property.key.name)
        }
      }
    } else if (node.left.property.name === 'defaultValue') {
      result = {
        'class': node.left.object.name,
        'type': 'defaultValue',
        'value': {}
      }
      let properties = node.right.properties
      for (let i = 0; i < properties.length; i++) {
        let property = properties[i]
        result.value[property.key.name] = property.value.value || null
      }
    }
  }
  return result
}
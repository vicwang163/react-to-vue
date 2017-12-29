module.exports = function (node) {
  let result = null
  if (node.left.type === 'MemberExpression') { 
    // prop-types
    if (node.left.property.name === 'propTypes') {
      result = {
        'class': node.left.object.name,
        'type': 'propTypes',
        'value': {}
      }
      let properties = node.right.properties
      for (let i = 0; i < properties.length; i++) {
        let property = properties[i]
        result.value[property.key.name] = property.value.property.name || null
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
// valid types that can be transformed to Vue types
const VALIDTYPES = {
  array: 'Array',
  bool: 'Boolean',
  func: 'Function',
  number: 'Number',
  object: 'Object',
  string: 'String',
  symbol: 'Symbol'
}

module.exports = function (node, root) {
  let result = null
  if (node.left.type === 'MemberExpression') { 
    // prop-types
    if (node.left.property.name === 'propTypes') {
      // component name
      let className = node.left.object.name
      result = root['propTypes'][className] = {}
      // properties loop
      let properties = node.right.properties
      for (let i = 0; i < properties.length; i++) {
        let property = properties[i]
        // get value of proptypes
        let value = property.value.property ? property.value.property.name : null
        if (property.value.property && (value === 'isRequired' || VALIDTYPES[value])) {
          // case: propTypes.string.isRequired
          if (value === 'isRequired') {
            result[property.key.name] = {
              type: VALIDTYPES[property.value.object.property.name],
              required: true
            }
          } else {
            result[property.key.name] = {
              type: VALIDTYPES[value]
            }
          }
        } else {
          // if it's not the specific types, default use `Object` type
          result[property.key.name] = {type: 'Object'}
          // add this proptype into caveats
          root.caveats.push(`Inconsistent propTypes: '${className}:${property.key.name}'`)
        }
      }
    } else if (node.left.property.name === 'defaultProps') {
      // component name
      let className = node.left.object.name
      let propTypeObj
      if (!root['propTypes'][className]) {
        propTypeObj = root['propTypes'][className] = {}
      } else {
        propTypeObj = root['propTypes'][className]
      }
      result = root['defaultValue'][className] = {}
      // properties loop
      let properties = node.right.properties
      for (let i = 0; i < properties.length; i++) {
        let property = properties[i]
        result[property.key.name] = property.value.value || root.source.slice(property.value.start, property.value.end)
        // check if propTypes exist
        if (!propTypeObj[property.key.name]) {
          property.value.type.replace(/^[A-Z][a-z]+/, function (value) {
            propTypeObj[property.key.name] = {type: value}
          })
        }
      }
    }
  }
}
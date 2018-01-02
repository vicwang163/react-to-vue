function parseConstructor (path, fileContent, result) {
  let statement = ''
  path.traverse({
    ExpressionStatement (expressPath) {
      let node = expressPath.node
      let sectionCon = fileContent.slice(node.start, node.end)
      if (/^super|\.bind\(this\)/.test(sectionCon)) {
        return
      }
      // achieve variables
      if (/^this\.state/.test(sectionCon)) {
        expressPath.traverse({
          ObjectExpression (objPath) {
            let properties = objPath.node.properties
            for (let i = 0; i < properties.length; i++) {
              let property = properties[i]
              let value = fileContent.slice(property.value.start, property.value.end)
              result.data[property.key.name] = value.replace(/this\.props/g, 'this').replace(/props/g, 'this')
            }
          }
        })
      }
    }
  })
}

module.exports = function getClass (path, fileContent) {
  let result = {
    data: {}
  }
  path.traverse({
    ClassMethod (path) {
      switch(path.node.key.name) {
       case 'constructor': 
         parseConstructor(path, fileContent, result);
         break;
      }
    }
  })
  return result
}
var babelTraverse = require('babel-traverse').default

module.exports = function (ast) {
  babelTraverse(ast,{
    ExportNamedDeclaration (exportPath) {
      let declaration = exportPath.get('declaration')
      if (declaration && declaration.isTSInterfaceDeclaration()) {
        exportPath.remove()
      }
    },
    TSTypeParameterInstantiation (path) {
      path.remove()
    },
    TSTypeAnnotation (path) {
      path.remove()
    }
  })
  return ast
}
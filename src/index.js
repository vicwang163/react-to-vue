var fs = require('fs')
var getProps = require('./props')
var getClass = require('./class')
var babelTraverse = require('babel-traverse').default
var babylon = require('babylon')

module.exports = function transform (src) {
  // read file
  let fileContent = fs.readFileSync(src)
  fileContent = fileContent.toString()
  // parse module
  let ast = babylon.parse(fileContent, {
    sourceType:'module',
    plugins: '*'
  })
  // traverse module
  let result = {
    "import": [],
    "export": [],
    "class": {},
    // there exists incompatibility
    "caveats": []
  }
  babelTraverse(ast, {
    Program (path) {
      let nodeLists = path.node.body
      for (let i = 0; i < nodeLists.length; i++) {
        let node = nodeLists[i]
        // get prop-types
        if (node.type === 'ExpressionStatement' && node.expression.type === 'AssignmentExpression') {
          let rt = getProps(node.expression)
          if (rt) {
            result['class'][rt.type] = rt.value
            // record invalid proptypes
            if (rt.caveats && rt.caveats.length) {
              result.caveats.push(`invalid propTypes: ${rt.class}:[${rt.caveats.join(',')}]`)
            }
          }
        }
      }
    },
    ImportDeclaration (path) {
      let node = path.node
      // skip react and prop-types modules
      if (["react", "prop-types"].includes(node.source.value)) {
        return
      }
      result.import.push(fileContent.slice(node.start, node.end))
    },
    ClassDeclaration (path) {
      result.class.className = path.node.id.name
      let rt = getClass(path, fileContent)
      Object.assign(result.class, rt)
    },
    ExportDefaultDeclaration () {
    }
  })
  console.log(result)
}
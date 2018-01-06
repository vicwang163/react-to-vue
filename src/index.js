var fs = require('fs')
var path = require('path')
var getProps = require('./props')
var getClass = require('./class')
var generateVueComponent = require('./generate')
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
    "class": {},
    // there exists incompatibility
    "caveats": []
  }
  babelTraverse(ast, {
    Program (path) {
      let nodeLists = path.node.body
      let classDefineCount = 0
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
        } else if (node.type === 'ClassDeclaration') {
          classDefineCount ++
          if (classDefineCount > 1) {
            console.error('One file should have only one class declaration!')
            process.exit()
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
      getClass(path, fileContent, result)
    }
  })
  // generate vue component according to object
  let output = generateVueComponent(result)
  // save file
  let dst = path.join(path.dirname(src), 'vue:' + path.basename(src))
  fs.writeFileSync(dst, output)
  // output caveats
  if (result.caveats.length) {
    console.log("Caveats:\n", result.caveats.join('\n'))
  }
}
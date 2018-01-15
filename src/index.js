var fs = require('fs')
var path = require('path')
var getProps = require('./props')
var getClass = require('./class')
var saveComponent = require('./save')
var generateVueComponent = require('./generate')
var getFunctional = require('./functional')
var babelTraverse = require('babel-traverse').default
var babylon = require('babylon')
var chalk = require('chalk')

module.exports = function transform (src, dst) {
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
    "functional": [],
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
            if (!result[rt.type]) {
              result[rt.type] = {}
            }
            result[rt.type][rt.class] = rt.value
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
        } else if (node.type === 'ExportDefaultDeclaration') {
          result.exportName = node.declaration.name ? node.declaration.name : node.declaration.id.name
        }
      }
      if (classDefineCount === 0) {
        result.class = null
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
      getClass(path, fileContent, result)
    },
    FunctionDeclaration (path) {
      if (path.parentPath.type !== 'Program') {
        return
      }
      // retrieve functional component
      getFunctional(path, fileContent, result)
    }
  })
  // generate vue component according to object
  let output = generateVueComponent(result)
  
  // save file
  saveComponent(dst, output)
  
  // output caveats
  if (result.caveats.length) {
    console.log(chalk.red("Caveats:"));
    console.log(chalk.red(result.caveats.join('\n')))
  }
}
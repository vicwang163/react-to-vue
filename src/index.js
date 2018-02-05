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
var transformTS = require('./ts')
var {reportIssue, removeBadCode, isVariableFunc} = require('./utility')

module.exports = function transform (src, options) {
  // read file
  let fileContent = fs.readFileSync(src)
  fileContent = fileContent.toString()
  // hard code
  fileContent = removeBadCode(fileContent)
  // parse module
  let ast = babylon.parse(fileContent, {
    sourceType:'module',
    plugins: ["typescript", "classProperties", "jsx", "trailingFunctionCommas", "asyncFunctions", "exponentiationOperator", "asyncGenerators", "objectRestSpread"]
  })
  if (options.ts) {
    transformTS(ast)
  }
  // fix trailingComments issues with hard code 
  babelTraverse(ast, {
    BlockStatement (path) {
      path.node.body.forEach((item) => {
        if (item.trailingComments && fileContent.charCodeAt([item.end]) === 10) {
          delete item.trailingComments
        }
      })
    }
  })
  // traverse module
  let result = {
    "import": [],
    "declaration": [],
    "class": {},
    "functional": [],
    "propTypes": {},
    "defaultProps": {},
    // there exists incompatibility
    "caveats": [],
    "source": fileContent
  }
  babelTraverse(ast, {
    Program (path) {
      let nodeLists = path.node.body
      let classDefineCount = 0
      for (let i = 0; i < nodeLists.length; i++) {
        let node = nodeLists[i]
        let cPath = path.get(`body.${i}`)
        // get prop-types
        if (cPath.isExpressionStatement() && node.expression.type === 'AssignmentExpression') {
          let leftNode = node.expression.left
          if (leftNode.type === 'MemberExpression' && ["defaultProps", "propTypes"].includes(leftNode.property.name)) {
            let className = node.expression.left.object.name
            getProps(className, leftNode.property.name, node.expression.right, result)
          }
        } else if (cPath.isClassDeclaration()) {
          classDefineCount ++
          if (classDefineCount > 1) {
            console.error('One file should have only one class declaration!')
            process.exit()
          }
        } else if (cPath.isExportDefaultDeclaration()) {
          result.exportName = node.declaration.name ? node.declaration.name : node.declaration.id.name
        } else if (cPath.isVariableDeclaration() && !isVariableFunc(cPath)) {
          // it's just simple variable declaration, e.g. `let a = 1`
          result.declaration.push(fileContent.slice(node.start, node.end))
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
      if (path.parentPath.type !== 'Program' && path.parentPath.type !== 'ExportDefaultDeclaration') {
        reportIssue('This component seems like HOC or something else, we may not support it')
      }
      getClass(path, fileContent, result)
    },
    FunctionDeclaration (path) {
      if (path.parentPath.type !== 'Program') {
        return
      }
      // retrieve functional component
      getFunctional(path, fileContent, result)
    },
    ArrowFunctionExpression (path) {
      let variablePath = path.findParent((p) => p.isVariableDeclaration())
      if (!variablePath || variablePath.parentPath.type !== 'Program' || path.getPathLocation().split('.').length > 4) {
        return
      }
      // retrieve functional component
      getFunctional(path, fileContent, result, 'arrow')
    }
  })
  // check props validation
  if (!Object.keys(result.propTypes).length && /props/.test(fileContent)) {
    result.caveats.push(`There is no props validation, please check it manually`)
  }
  // generate vue component according to object
  let output = generateVueComponent(result)
  
  // save file
  saveComponent(options.output, output)
  
  // output caveats
  if (result.caveats.length) {
    console.log(chalk.red("Caveats:"));
    console.log(chalk.red(result.caveats.join('\n')))
  }
}
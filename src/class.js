var generate = require('babel-generator').default
var babelTraverse = require('babel-traverse').default
var babylon = require('babylon')
var babelTypes = require('babel-types')
// autumatically increate index 
var refIndex = 0

/*
* transform source string to ast nodes
*/
function transformSourceString (statement) {
  if (!Array.isArray(statement)) {
    statement = [statement]
  }
  let result = []
  for (let i = 0; i < statement.length; i++) {
    let replacement = "(" + statement[i] + ")"
    replacement = babylon.parse(replacement)
    replacement = replacement.program.body[0].expression
    result.push(babelTraverse.removeProperties(replacement))
  }
  return result
}

/*
* transform setState function
*/
function transformSetstate (node, fileContent) {
  let statement = []
  let args = node.expression.arguments
  let str = ''
  if (args[0]) {
    str = fileContent.slice(args[0].start, args[0].end)
    if (args[0].type === 'ObjectExpression') {
      args[0].properties.map(function (property) {
        statement.push(`this.${property.key.name} = ${fileContent.slice(property.value.start, property.value.end)}`)
      })
    } else {
      str = '(' + str + ')(this, this)'
      statement.push(`Object.assign(this, ${str})`)
    }
  }
  // there exits callback
  if (args[1]) {
    let callback = fileContent.slice(args[1].start, args[1].end)
    statement.push(`this.$nextTick(${callback})`)
  }
  // transform source string to nodes
  statement = transformSourceString(statement)
  return statement
}

/*
* generate BlockStatement
*/
function generateMethod (node) {
  let tempAst = babylon.parse('{console.log(1)}')
  let executed = false
  let rt
  babelTraverse(tempAst, {
    BlockStatement (tempPath) {
      if (executed) {
        return
      }
      executed = true
      tempPath.replaceWith(node)
    }
  })
  rt = generate(tempAst, {})
  rt = rt.code
  return rt
}

/*
* replace setState,ref and etc
*/
function replaceSpecialStatement (path, fileContent) {
  path.traverse({
    ExpressionStatement(expressPath) {
      let node = expressPath.node;
      if (!node.start) {
        return;
      }
      let sectionCon = fileContent.slice(node.start, node.end);
      let statement = "";
      if (/^this\.setState/.test(sectionCon)) {
        // transform setState
        statement = transformSetstate(node, fileContent);
      }
      if (statement.length) {
        expressPath.replaceWithMultiple(statement);
      }
    },
    MemberExpression (memPath) {
      let node = memPath.node
      if (node.property.name === 'refs') {
        if (node.object.type === 'ThisExpression') {
          node.property.name = '$refs'
        }
      }
    }
  });  
}

// parse constructor
function parseConstructor (path, fileContent, result, root) {
  path.traverse({
    ExpressionStatement (expressPath) {
      let node = expressPath.node
      let sectionCon = fileContent.slice(node.start, node.end)
      if (/^super|\.bind\(this\)/.test(sectionCon)) {
        return
      }
      // retrieve variables
      if (/^this\.state/.test(sectionCon)) {
        expressPath.traverse({
          ObjectExpression (objPath) {
            let properties = objPath.node.properties
            for (let i = 0; i < properties.length; i++) {
              let property = properties[i]
              let value = fileContent.slice(property.value.start, property.value.end)
              // validate if it exists in the props
              if (root.propTypes && root.propTypes[result.className] && root.propTypes[result.className][property.key.name]) {
                root.caveats.push(`The data property "${property.key.name}" is already declared as a prop`)
              } else {
                result.data[property.key.name] = value.replace(/this\.props/g, 'this').replace(/props/g, 'this')
              }
            }
          }
        })
      }
    }
  })
}
// parse life cycle methods
function parseLifeCycle (path, method, fileContent, result) {
  // replace special statement
  replaceSpecialStatement(path, fileContent)
  // debugger
  let code = generateMethod(path.node.body)
  // here we remove the brace, so that we could add extra code in the lifecycle method
  result.lifeCycles[method] = code.replace(/^{|}$/g, '')
}

// parse events
function parseMethods (path, fileContent, result) {
  // replace special statement
  replaceSpecialStatement(path, fileContent)
  // generate method
  let code = generateMethod(path.node.body);
  let method = path.node.key.name
  let params = path.node.params
  let paramsArr = []
  for (let i = 0; i < params.length; i++) {
    paramsArr.push(fileContent.slice(params[i].start, params[i].end))
  }
  code = `${method} (${paramsArr.join(', ')}) ${code}`
  result.methods.push(code)
}

// parse render
function parseRender (path, fileContent, result) {
  // retrieve special properties
  path.traverse({
    JSXElement (jsxPath) {
      let element = jsxPath.node.openingElement
      // find sub component
      if (element.name && element.name.name && /^[A-Z]/.test(element.name.name)) {
        result.components.push(element.name.name)
      }
    },
    JSXAttribute (attrPath) {
      // if value of ref property is callback, we need to change it
      if (attrPath.node.name.name === 'ref' && attrPath.node.value.type !== 'StringLiteral') {
        let value = attrPath.node.value
        let code = fileContent.slice(value.expression.start, value.expression.end)
        let refValue = 'vueref' + refIndex++
        attrPath.traverse({
          JSXExpressionContainer (cPath) {
            cPath.replaceWith(babelTypes.stringLiteral(refValue))
          }
        })
        // add the ref callback code into specified lifecycle
        let mountCode = `(${code})(this.$refs.${refValue})`
        // let unmountCode = `(${code})(null)`
        result.lifeCycles.mounted = mountCode + (result.lifeCycles.mounted ? result.lifeCycles.mounted : '')
        result.lifeCycles.updated = mountCode + (result.lifeCycles.updated ? result.lifeCycles.updated : '')
        // result.lifeCycles.destroyed = unmountCode + (result.lifeCycles.destroyed ? result.lifeCycles.destroyed : '')
      }
    },
    MemberExpression (memPath) {
      // change `this.state` and `this.props` to `this`
      let node = memPath.node
      if (['state', 'props'].includes(node.property.name)) {
        if (node.object.type === 'ThisExpression') {
          memPath.replaceWith(babelTypes.thisExpression())
        }
      }
    }
  })
  let code = generateMethod(path.node.body);
  result.render = `render () ${code}`
}

module.exports = function getClass (path, fileContent, root) {
  Object.assign(root.class, {
    data: {},
    methods: [],
    lifeCycles: {},
    components: []
  })
  let result = root.class
  
  path.traverse({
    ClassMethod (path) {
      switch(path.node.key.name) {
        case 'constructor':
          parseConstructor(path, fileContent, result, root);
          break;
        case 'componentWillMount':
          parseLifeCycle(path, 'beforeMount', fileContent, result);
          break;
        case 'componentDidMount':
          parseLifeCycle(path, 'mounted', fileContent, result);
          break;
        case 'componentWillUpdate':
          parseLifeCycle(path, 'beforeUpdate', fileContent, result);
          break;
        case 'componentDidUpdate':
          parseLifeCycle(path, 'updated', fileContent, result);
          break;
        case 'componentWillUnmount':
          parseLifeCycle(path, 'destroyed', fileContent, result);
          break;
        case 'componentDidCatch':
          parseLifeCycle(path, 'errorCaptured', fileContent, result);
          break;
        case 'shouldComponentUpdate':
        case 'componentWillReceiveProps':
          break;
        case 'render':
          parseRender(path, fileContent, result);
          break;
        default:
          parseMethods(path, fileContent, result);
          break;
      }
    }
  })
  return result
}
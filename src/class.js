var beautify = require('js-beautify').js_beautify
var generate = require('babel-generator').default
var babelTraverse = require('babel-traverse').default
var babylon = require('babylon')

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
      statement.push(`Object.assign(this, ${str})`)
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
  return statement.join(',')
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
  rt = beautify(rt.code)
  return rt
}

// parse constructor
function parseConstructor (path, fileContent, result) {
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
              result.data[property.key.name] = value.replace(/this\.props/g, 'this').replace(/props/g, 'this')
            }
          }
        })
      }
    }
  })
}
// parse life cycle methods
function parseLifeCycle (path, method, fileContent, result) {
  path.traverse({
    ExpressionStatement (expressPath) {
      let node = expressPath.node
      if (!node.start) {
        return
      }
      let sectionCon = fileContent.slice(node.start, node.end)
      let statement = ""
      if (/^this\.setState/.test(sectionCon)) {
        // transform setState
        statement = transformSetstate(node, fileContent)
      }
      if (statement) {
        expressPath.replaceWithSourceString(statement)
      }
    }
  })
  // debugger
  let code = generateMethod(path.node.body)
  result[method] = `${method} () ${code}`
}

// parse events
function parseMethods (path, fileContent, result) {
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
      if (statement) {
        expressPath.replaceWithSourceString(statement);
      }
    }
  });
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
  
}

module.exports = function getClass (path, fileContent) {
  let result = {
    data: {},
    methods: []
  }
  path.traverse({
    ClassMethod (path) {
      switch(path.node.key.name) {
        case 'constructor':
          parseConstructor(path, fileContent, result);
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
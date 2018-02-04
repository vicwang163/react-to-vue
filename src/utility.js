const chalk = require('chalk')
const babelTraverse = require('babel-traverse').default
const babylon = require('babylon')
const generate = require('babel-generator').default

export function reportIssue (msg) {
  msg && console.log(msg)
  console.log(chalk.red('Please report issue here:') + chalk.underline.red('https://github.com/vicwang163/react-to-vue/issues'))
  process.exit()
}

/*
* transform source string to ast nodes
*/
export function transformSourceString (statement) {
  if (!Array.isArray(statement)) {
    statement = [statement]
  }
  let result = []
  for (let i = 0; i < statement.length; i++) {
    let replacement = statement[i]
    replacement = babylon.parse(replacement)
    replacement = replacement.program.body[0]
    result.push(babelTraverse.removeProperties(replacement))
  }
  return result
}

/*
* transform component name
*/
export function transformComponentName (name) {
  if (/[A-Z]{2,}/.test(name)) {
    return name
  }
  return name.replace(/^[A-Z]/, v => v.toLowerCase()).replace(/[A-Z]/g, v => '-' + v.toLowerCase())
}

/*
* generate BlockStatement
*/
export function getFunctionBody (node) {
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
  rt = rt.code.replace(/^{|}$/g, '')
  return rt
}

/*
* remove bad code with hard code for now
*/
export function removeBadCode (con) {
  return con.replace(/\.\.\.(\w+),\n/, function (a, v) {return '...' + v + '\n'})
}

/*
* check if the VariableDeclaration is function, like 'let a = function () {}'
*/

export function isVariableFunc (path) {
  let result = false
  path.traverse({
    "ArrowFunctionExpression|FunctionDeclaration" (p) {
      result = true
      p.stop()
    }
  })
  return result
}

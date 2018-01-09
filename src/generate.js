var format = require("prettier-eslint");
var babelTraverse = require('babel-traverse').default

module.exports = function generateVueComponent (object) {
  let content = ''
  // generate imports
  if (object.import) {
    content += object.import.join('\n')
    content += '\n\n'
  }
  // generate body
  if (object.class) {
    let body = object.class
    // vueProps is designed to put vue properties
    let vueProps = []
    content += 'export default {\n'
    // add props
    if (body.propTypes) {
      let props = body.propTypes
      let propArr = []
      for (let item in props) {
        let value = props[item]
        if (body.defaultValue && body.defaultValue[item]) {
          value.default = body.defaultValue[item]
        }
        let arr = []
        for (let key in value) {
          if (key === 'type') {
            arr.push(`${key}: ${value[key]}`)
          } else {
            arr.push(`${key}: ${ typeof value[key] === 'string' ? `'${value[key]}'` : value[key] }`)
          }
        }
        propArr.push(`${item}: {${arr.join(',\n')}}`)
      }
      vueProps.push(`props: {${propArr.join(',\n')}}`)
    }
    // add data
    if (body.data) {
      let data = body.data
      let arr = []
      for (let key in data) {
        arr.push(`${key}: ${data[key]}`)
      }
      let value = `return {${arr.join(',\n')}}`
      vueProps.push(`data () {${value}}`)
    }
    
    // add methods
    if (body.methods.length) {
      vueProps.push(`methods: {${body.methods.join(',')}}`)
    }
    
    // add life cycles
    if (body.lifeCycles.length) {
      vueProps.push(`${body.lifeCycles.join(',')}`)
    }
    
    // add sub components
    if (body.components) {
      let result = []
      // validate components
      body.components.forEach(function (com) {
        let exist = object.import.some(function (value) {
          return value.includes(com)
        })
        if (exist) {
          result.push(com)
        }
      })
      // if exists necessary components
      if (result.length) {
        vueProps.push(`components: {${result.join(',')}}`)
        // replace sub components according to Vue rules
        result.forEach(function (value) {
          let reg = new RegExp(`<${value}`, 'g')
          body.render = body.render.replace(reg, function (r) {
            return r.replace(/^<[A-Z]/, v => v.toLowerCase()).replace(/[A-Z]/g, v => '-' + v.toLowerCase())
          })
        })
      }
    }
    
    // add render
    if (body.render) {
      vueProps.push(`${body.render}`)
    }
    // generate body
    content += vueProps.join(',\n') + '}'
  }
  // format content
  const options = {
    text: content,
    eslintConfig: {
      parser: 'babel-eslint',
      rules: {
        semi: ["error", "never"],
        quotes: ["error", "single"],
        "object-curly-spacing": ["error", "never"],
        "space-before-function-paren": ["error", "always"]
      }
    }
  };
  content = format(options);
  return content
}
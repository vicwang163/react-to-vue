var format = require("prettier-eslint");
var babelTraverse = require('babel-traverse').default
var {transformComponentName} = require('./utility')

function mergeExportComponent (object) {
  let com = null;
  object.functional.forEach((func, index) => {
    if (func.functional) {
      com = func
      // remove functional component
      object.functional.splice(index, 1)
    }
  })
  if (!com) {
    com = object.class
  }
  return com
}

module.exports = function generateVueComponent (object) {
  let content = ''
  // add imports
  object.import.forEach((item) => {
    content += item + '\n'
  })
  
  // add variable declaration
  object.declaration.forEach((item) => {
    content += item + '\n'
  })
  content += '\n\n'
  
  // merge export component
  let component = mergeExportComponent(object)
  
  // generate common function
  object.functional.forEach((func) => {
    // common function
    content += func
  })
  
  // generate export component
  if (component && component.render) {
    // add class static variables and methods if exists
    if (component.static) {
      for (let name in component.static) {
        content += `const static_${name} = ${component.static[name]}\n`
      }
    }
    // vueProps is designed to put vue properties
    let vueProps = []
    content += '// export component\n'
    content += 'export default {\n'
    
    // add component name
    if (component.componentName) {
      vueProps.push(`name: '${transformComponentName(component.componentName)}'`)
    }
    
    // add functional tag if it's a functional component
    if (component.functional) {
      vueProps.push(`functional: true`)
    }
    
    // add props
    if (object.propTypes && object.propTypes[component.componentName]) {
      let props = object.propTypes[component.componentName]
      let defaultValues = object.defaultProps && object.defaultProps[component.componentName]
      let propArr = []
      for (let item in props) {
        let value = props[item]
        if (defaultValues && defaultValues[item]) {
          value.default = defaultValues[item]
        }
        let arr = []
        for (let key in value) {
          if (key === 'type') {
            arr.push(`${key}: ${value[key]}`)
          } else if (key === 'required') {
            arr.push(`${key}: ${value[key]}`)
          } else {
            arr.push(`${key}: ${ value.type === 'String' ? `'${value[key]}'` : value[key] }`)
          }
        }
        propArr.push(`${item}: {${arr.join(',\n')}}`)
      }
      vueProps.push(`props: {${propArr.join(',\n')}}`)
    }
    // add data
    if (component.data && Object.keys(component.data).length) {
      let data = component.data
      let arr = []
      for (let key in data) {
        arr.push(`${key}: ${data[key]}`)
      }
      let value = `return {${arr.join(',\n')}}`
      vueProps.push(`data () {${value}}`)
    }
    
    // add methods
    if (component.methods && component.methods.length) {
      vueProps.push(`methods: {${component.methods.join(',')}}`)
    }
    
    // add life cycles
    if (component.lifeCycles && Object.keys(component.lifeCycles).length) {
      let lifeCycles = []
      for (let key in component.lifeCycles) {
        lifeCycles.push(`${key} () {${component.lifeCycles[key]}}`)
      }
      vueProps.push(`${lifeCycles.join(',')}`)
    }
    
    // add sub components
    if (component.components) {
      let result = []
      // validate components
      component.components.forEach(function (com) {
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
      }
    }
    
    // add render
    if (component.render) {
      vueProps.push(`${component.render}`)
    }
    // generate component
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
        "no-extra-semi": 2,
        "max-len": ["error", { "code": 150 }],
        "object-curly-spacing": ["error", "never"],
        "space-before-function-paren": ["error", "always"],
        "no-multiple-empty-lines": ["error", { "max": 0}],
        "line-comment-position": ["error", { "position": "beside" }]
      }
    }
  };
  content = format(options);
  return content
}
var fs = require('fs')
var path = require('path')

module.exports = function (dst, output) {
  if (dst) {
    if (!path.isAbsolute(dst)) {
      dst = path.resolve(process.cwd(), dst)
    }
    fs.writeFileSync(dst, output)
  } else {
    console.log(output)
  }
}

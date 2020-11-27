// Variables used by Scriptable.
// These must be at the very top of the file. Do not edit.
// icon-color: yellow; icon-glyph: magic;

// This script was created by Max Zeryck.

// The amount of blurring. Default is 150.
let blur = 150
 
// Determine if user has taken the screenshot.
var message
message = "Before you start, go to your home screen and enter wiggle mode. Scroll to the empty page on the far right and take a screenshot."
let options = ["Continue to select image","Exit to take screenshot","Update code"]
let response = await generateAlert(message,options)

// Return if we need to exit.
if (response == 1) return

// Update the code.
if (response == 2) {

  // Determine if the user is using iCloud.
  let files = FileManager.local()
  const iCloudInUse = files.isFileStoredIniCloud(module.filename)

  // If so, use an iCloud file manager.
  files = iCloudInUse ? FileManager.iCloud() : files

  // Try to download the file.
  try {
    const req = new Request("https://raw.githubusercontent.com/mzeryck/Widget-Blur/main/widget-blur.js")
    const codeString = await req.loadString()
    files.writeString(module.filename, codeString)
    message = "The code has been updated. If the script is open, close it for the change to take effect."
  } catch {
    message = "The update failed. Please try again later."
  }
  options = ["OK"]
  await generateAlert(message,options)
  return
}
  
// Get screenshot and determine phone size.
let img = await Photos.fromLibrary()
let height = img.size.height
let phone = phoneSizes()[height]
if (!phone) {
  message = "It looks like you selected an image that isn't an iPhone screenshot, or your iPhone is not supported. Try again with a different image."
  await generateAlert(message,["OK"])
  return
}

// Extra setup needed for 2436-sized phones.
if (height == 2436) {

  let files = FileManager.local()
  let cacheName = "mz-phone-type"
  let cachePath = files.joinPath(files.libraryDirectory(), cacheName)

  // If we already cached the phone size, load it.
  if (files.fileExists(cachePath)) {
    let typeString = files.readString(cachePath)
    phone = phone[typeString]
  
  // Otherwise, prompt the user.
  } else { 
    message = "What type of iPhone do you have?"
    let types = ["iPhone 12 mini", "iPhone 11 Pro, XS, or X"]
    let typeIndex = await generateAlert(message, types)
    let type = (typeIndex == 0) ? "mini" : "x"
    phone = phone[type]
    files.writeString(cachePath, type)
  }
}

// Prompt for widget size and position.
message = "What size of widget are you creating?"
let sizes = ["Small","Medium","Large"]
let size = await generateAlert(message,sizes)
let widgetSize = sizes[size]

message = "What position will it be in?"
message += (height == 1136 ? " (Note that your device only supports two rows of widgets, so the middle and bottom options are the same.)" : "")

// Determine image crop based on phone size.
let crop = { w: "", h: "", x: "", y: "" }
if (widgetSize == "Small") {
  crop.w = phone.small
  crop.h = phone.small
  let positions = ["Top left","Top right","Middle left","Middle right","Bottom left","Bottom right"]
  let position = await generateAlert(message,positions)
  
  // Convert the two words into two keys for the phone size dictionary.
  let keys = positions[position].toLowerCase().split(' ')
  crop.y = phone[keys[0]]
  crop.x = phone[keys[1]]
  
} else if (widgetSize == "Medium") {
  crop.w = phone.medium
  crop.h = phone.small
  
  // Medium and large widgets have a fixed x-value.
  crop.x = phone.left
  let positions = ["Top","Middle","Bottom"]
  let position = await generateAlert(message,positions)
  let key = positions[position].toLowerCase()
  crop.y = phone[key]
  
} else if(widgetSize == "Large") {
  crop.w = phone.medium
  crop.h = phone.large
  crop.x = phone.left
  let positions = ["Top","Bottom"]
  let position = await generateAlert(message,positions)
  
  // Large widgets at the bottom have the "middle" y-value.
  crop.y = position ? phone.middle : phone.top
}

// Prompt for blur style.
message = "Do you want a fully transparent widget, or a translucent blur effect?"
let blurOptions = ["Transparent","Light blur","Dark blur","Just blur"]
let blurred = await generateAlert(message,blurOptions)

// We always need the cropped image.
let imgCrop = cropImage(img)

// If it's blurred, set the blur style.
if (blurred) {
  const styles = ["", "light", "dark", "none"]
  const style = styles[blurred]
  imgCrop = await blurImage(img,imgCrop,style)
}

message = "Your widget background is ready. Choose where to save the image:"
const exportPhotoOptions = ["Export to the Photos app","Export to the Files app"]
const exportToFiles = await generateAlert(message,exportPhotoOptions)

if (exportToFiles) { 
  await DocumentPicker.exportImage(imgCrop) 
} else { 
  Photos.save(imgCrop) 
}

Script.complete()

// Generate an alert with the provided array of options.
async function generateAlert(message,options) {
  
  let alert = new Alert()
  alert.message = message
  
  for (const option of options) {
    alert.addAction(option)
  }
  
  let response = await alert.presentAlert()
  return response
}

// Crop an image into the specified rect.
function cropImage(image) {
   
  let draw = new DrawContext()
  let rect = new Rect(crop.x,crop.y,crop.w,crop.h)
  draw.size = new Size(rect.width, rect.height)
  
  draw.drawImageAtPoint(image,new Point(-rect.x, -rect.y))  
  return draw.getImage()
}

async function blurImage(img,imgCrop,style) {
  const js = `
  /*

  StackBlur - a fast almost Gaussian Blur For Canvas

  Version:   0.5
  Author:    Mario Klingemann
  Contact:   mario@quasimondo.com
  Website:  http://quasimondo.com/StackBlurForCanvas/StackBlurDemo.html
  Twitter:  @quasimondo

  In case you find this class useful - especially in commercial projects -
  I am not totally unhappy for a small donation to my PayPal account
  mario@quasimondo.de

  Or support me on flattr: 
  https://flattr.com/thing/72791/StackBlur-a-fast-almost-Gaussian-Blur-Effect-for-CanvasJavascript

  Copyright (c) 2010 Mario Klingemann

  Permission is hereby granted, free of charge, to any person
  obtaining a copy of this software and associated documentation
  files (the "Software"), to deal in the Software without
  restriction, including without limitation the rights to use,
  copy, modify, merge, publish, distribute, sublicense, and/or sell
  copies of the Software, and to permit persons to whom the
  Software is furnished to do so, subject to the following
  conditions:

  The above copyright notice and this permission notice shall be
  included in all copies or substantial portions of the Software.

  THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND,
  EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES
  OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND
  NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT
  HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY,
  WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING
  FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR
  OTHER DEALINGS IN THE SOFTWARE.
  */

  var mul_table = [
          512,512,456,512,328,456,335,512,405,328,271,456,388,335,292,512,
          454,405,364,328,298,271,496,456,420,388,360,335,312,292,273,512,
          482,454,428,405,383,364,345,328,312,298,284,271,259,496,475,456,
          437,420,404,388,374,360,347,335,323,312,302,292,282,273,265,512,
          497,482,468,454,441,428,417,405,394,383,373,364,354,345,337,328,
          320,312,305,298,291,284,278,271,265,259,507,496,485,475,465,456,
          446,437,428,420,412,404,396,388,381,374,367,360,354,347,341,335,
          329,323,318,312,307,302,297,292,287,282,278,273,269,265,261,512,
          505,497,489,482,475,468,461,454,447,441,435,428,422,417,411,405,
          399,394,389,383,378,373,368,364,359,354,350,345,341,337,332,328,
          324,320,316,312,309,305,301,298,294,291,287,284,281,278,274,271,
          268,265,262,259,257,507,501,496,491,485,480,475,470,465,460,456,
          451,446,442,437,433,428,424,420,416,412,408,404,400,396,392,388,
          385,381,377,374,370,367,363,360,357,354,350,347,344,341,338,335,
          332,329,326,323,320,318,315,312,310,307,304,302,299,297,294,292,
          289,287,285,282,280,278,275,273,271,269,267,265,263,261,259];
        
   
  var shg_table = [
         9, 11, 12, 13, 13, 14, 14, 15, 15, 15, 15, 16, 16, 16, 16, 17, 
      17, 17, 17, 17, 17, 17, 18, 18, 18, 18, 18, 18, 18, 18, 18, 19, 
      19, 19, 19, 19, 19, 19, 19, 19, 19, 19, 19, 19, 19, 20, 20, 20,
      20, 20, 20, 20, 20, 20, 20, 20, 20, 20, 20, 20, 20, 20, 20, 21,
      21, 21, 21, 21, 21, 21, 21, 21, 21, 21, 21, 21, 21, 21, 21, 21,
      21, 21, 21, 21, 21, 21, 21, 21, 21, 21, 22, 22, 22, 22, 22, 22, 
      22, 22, 22, 22, 22, 22, 22, 22, 22, 22, 22, 22, 22, 22, 22, 22,
      22, 22, 22, 22, 22, 22, 22, 22, 22, 22, 22, 22, 22, 22, 22, 23, 
      23, 23, 23, 23, 23, 23, 23, 23, 23, 23, 23, 23, 23, 23, 23, 23,
      23, 23, 23, 23, 23, 23, 23, 23, 23, 23, 23, 23, 23, 23, 23, 23,
      23, 23, 23, 23, 23, 23, 23, 23, 23, 23, 23, 23, 23, 23, 23, 23, 
      23, 23, 23, 23, 23, 24, 24, 24, 24, 24, 24, 24, 24, 24, 24, 24, 
      24, 24, 24, 24, 24, 24, 24, 24, 24, 24, 24, 24, 24, 24, 24, 24,
      24, 24, 24, 24, 24, 24, 24, 24, 24, 24, 24, 24, 24, 24, 24, 24,
      24, 24, 24, 24, 24, 24, 24, 24, 24, 24, 24, 24, 24, 24, 24, 24,
      24, 24, 24, 24, 24, 24, 24, 24, 24, 24, 24, 24, 24, 24, 24 ];

  function stackBlurCanvasRGB( id, top_x, top_y, width, height, radius )
  {
    if ( isNaN(radius) || radius < 1 ) return;
    radius |= 0;
  
    var canvas  = document.getElementById( id );
    var context = canvas.getContext("2d");
    var imageData;
  
    try {
      try {
      imageData = context.getImageData( top_x, top_y, width, height );
      } catch(e) {
    
      // NOTE: this part is supposedly only needed if you want to work with local files
      // so it might be okay to remove the whole try/catch block and just use
      // imageData = context.getImageData( top_x, top_y, width, height );
      try {
        netscape.security.PrivilegeManager.enablePrivilege("UniversalBrowserRead");
        imageData = context.getImageData( top_x, top_y, width, height );
      } catch(e) {
        alert("Cannot access local image");
        throw new Error("unable to access local image data: " + e);
        return;
      }
      }
    } catch(e) {
      alert("Cannot access image");
      throw new Error("unable to access image data: " + e);
    }
      
    var pixels = imageData.data;
      
    var x, y, i, p, yp, yi, yw, r_sum, g_sum, b_sum,
    r_out_sum, g_out_sum, b_out_sum,
    r_in_sum, g_in_sum, b_in_sum,
    pr, pg, pb, rbs;
      
    var div = radius + radius + 1;
    var w4 = width << 2;
    var widthMinus1  = width - 1;
    var heightMinus1 = height - 1;
    var radiusPlus1  = radius + 1;
    var sumFactor = radiusPlus1 * ( radiusPlus1 + 1 ) / 2;
  
    var stackStart = new BlurStack();
    var stack = stackStart;
    for ( i = 1; i < div; i++ )
    {
      stack = stack.next = new BlurStack();
      if ( i == radiusPlus1 ) var stackEnd = stack;
    }
    stack.next = stackStart;
    var stackIn = null;
    var stackOut = null;
  
    yw = yi = 0;
  
    var mul_sum = mul_table[radius];
    var shg_sum = shg_table[radius];
  
    for ( y = 0; y < height; y++ )
    {
      r_in_sum = g_in_sum = b_in_sum = r_sum = g_sum = b_sum = 0;
    
      r_out_sum = radiusPlus1 * ( pr = pixels[yi] );
      g_out_sum = radiusPlus1 * ( pg = pixels[yi+1] );
      b_out_sum = radiusPlus1 * ( pb = pixels[yi+2] );
    
      r_sum += sumFactor * pr;
      g_sum += sumFactor * pg;
      b_sum += sumFactor * pb;
    
      stack = stackStart;
    
      for( i = 0; i < radiusPlus1; i++ )
      {
        stack.r = pr;
        stack.g = pg;
        stack.b = pb;
        stack = stack.next;
      }
    
      for( i = 1; i < radiusPlus1; i++ )
      {
        p = yi + (( widthMinus1 < i ? widthMinus1 : i ) << 2 );
        r_sum += ( stack.r = ( pr = pixels[p])) * ( rbs = radiusPlus1 - i );
        g_sum += ( stack.g = ( pg = pixels[p+1])) * rbs;
        b_sum += ( stack.b = ( pb = pixels[p+2])) * rbs;
      
        r_in_sum += pr;
        g_in_sum += pg;
        b_in_sum += pb;
      
        stack = stack.next;
      }
    
    
      stackIn = stackStart;
      stackOut = stackEnd;
      for ( x = 0; x < width; x++ )
      {
        pixels[yi]   = (r_sum * mul_sum) >> shg_sum;
        pixels[yi+1] = (g_sum * mul_sum) >> shg_sum;
        pixels[yi+2] = (b_sum * mul_sum) >> shg_sum;
      
        r_sum -= r_out_sum;
        g_sum -= g_out_sum;
        b_sum -= b_out_sum;
      
        r_out_sum -= stackIn.r;
        g_out_sum -= stackIn.g;
        b_out_sum -= stackIn.b;
      
        p =  ( yw + ( ( p = x + radius + 1 ) < widthMinus1 ? p : widthMinus1 ) ) << 2;
      
        r_in_sum += ( stackIn.r = pixels[p]);
        g_in_sum += ( stackIn.g = pixels[p+1]);
        b_in_sum += ( stackIn.b = pixels[p+2]);
      
        r_sum += r_in_sum;
        g_sum += g_in_sum;
        b_sum += b_in_sum;
      
        stackIn = stackIn.next;
      
        r_out_sum += ( pr = stackOut.r );
        g_out_sum += ( pg = stackOut.g );
        b_out_sum += ( pb = stackOut.b );
      
        r_in_sum -= pr;
        g_in_sum -= pg;
        b_in_sum -= pb;
      
        stackOut = stackOut.next;

        yi += 4;
      }
      yw += width;
    }

  
    for ( x = 0; x < width; x++ )
    {
      g_in_sum = b_in_sum = r_in_sum = g_sum = b_sum = r_sum = 0;
    
      yi = x << 2;
      r_out_sum = radiusPlus1 * ( pr = pixels[yi]);
      g_out_sum = radiusPlus1 * ( pg = pixels[yi+1]);
      b_out_sum = radiusPlus1 * ( pb = pixels[yi+2]);
    
      r_sum += sumFactor * pr;
      g_sum += sumFactor * pg;
      b_sum += sumFactor * pb;
    
      stack = stackStart;
    
      for( i = 0; i < radiusPlus1; i++ )
      {
        stack.r = pr;
        stack.g = pg;
        stack.b = pb;
        stack = stack.next;
      }
    
      yp = width;
    
      for( i = 1; i <= radius; i++ )
      {
        yi = ( yp + x ) << 2;
      
        r_sum += ( stack.r = ( pr = pixels[yi])) * ( rbs = radiusPlus1 - i );
        g_sum += ( stack.g = ( pg = pixels[yi+1])) * rbs;
        b_sum += ( stack.b = ( pb = pixels[yi+2])) * rbs;
      
        r_in_sum += pr;
        g_in_sum += pg;
        b_in_sum += pb;
      
        stack = stack.next;
    
        if( i < heightMinus1 )
        {
          yp += width;
        }
      }
    
      yi = x;
      stackIn = stackStart;
      stackOut = stackEnd;
      for ( y = 0; y < height; y++ )
      {
        p = yi << 2;
        pixels[p]   = (r_sum * mul_sum) >> shg_sum;
        pixels[p+1] = (g_sum * mul_sum) >> shg_sum;
        pixels[p+2] = (b_sum * mul_sum) >> shg_sum;
      
        r_sum -= r_out_sum;
        g_sum -= g_out_sum;
        b_sum -= b_out_sum;
      
        r_out_sum -= stackIn.r;
        g_out_sum -= stackIn.g;
        b_out_sum -= stackIn.b;
      
        p = ( x + (( ( p = y + radiusPlus1) < heightMinus1 ? p : heightMinus1 ) * width )) << 2;
      
        r_sum += ( r_in_sum += ( stackIn.r = pixels[p]));
        g_sum += ( g_in_sum += ( stackIn.g = pixels[p+1]));
        b_sum += ( b_in_sum += ( stackIn.b = pixels[p+2]));
      
        stackIn = stackIn.next;
      
        r_out_sum += ( pr = stackOut.r );
        g_out_sum += ( pg = stackOut.g );
        b_out_sum += ( pb = stackOut.b );
      
        r_in_sum -= pr;
        g_in_sum -= pg;
        b_in_sum -= pb;
      
        stackOut = stackOut.next;
      
        yi += width;
      }
    }
  
    context.putImageData( imageData, top_x, top_y );
  
  }

  function BlurStack()
  {
    this.r = 0;
    this.g = 0;
    this.b = 0;
    this.a = 0;
    this.next = null;
  }
  
  // https://gist.github.com/mjackson/5311256

  function rgbToHsl(r, g, b){
      r /= 255, g /= 255, b /= 255;
      var max = Math.max(r, g, b), min = Math.min(r, g, b);
      var h, s, l = (max + min) / 2;

      if(max == min){
          h = s = 0; // achromatic
      }else{
          var d = max - min;
          s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
          switch(max){
              case r: h = (g - b) / d + (g < b ? 6 : 0); break;
              case g: h = (b - r) / d + 2; break;
              case b: h = (r - g) / d + 4; break;
          }
          h /= 6;
      }

      return [h, s, l];
  }

  function hslToRgb(h, s, l){
      var r, g, b;

      if(s == 0){
          r = g = b = l; // achromatic
      }else{
          var hue2rgb = function hue2rgb(p, q, t){
              if(t < 0) t += 1;
              if(t > 1) t -= 1;
              if(t < 1/6) return p + (q - p) * 6 * t;
              if(t < 1/2) return q;
              if(t < 2/3) return p + (q - p) * (2/3 - t) * 6;
              return p;
          }

          var q = l < 0.5 ? l * (1 + s) : l + s - l * s;
          var p = 2 * l - q;
          r = hue2rgb(p, q, h + 1/3);
          g = hue2rgb(p, q, h);
          b = hue2rgb(p, q, h - 1/3);
      }

      return [Math.round(r * 255), Math.round(g * 255), Math.round(b * 255)];
  }
  
  function lightBlur(hsl) {
  
    // Adjust the luminance.
    let lumCalc = 0.35 + (0.3 / hsl[2]);
    if (lumCalc < 1) { lumCalc = 1; }
    else if (lumCalc > 3.3) { lumCalc = 3.3; }
    const l = hsl[2] * lumCalc;
    
    // Adjust the saturation. 
    const colorful = 2 * hsl[1] * l;
    const s = hsl[1] * colorful * 1.5;
    
    return [hsl[0],s,l];
    
  }
  
  function darkBlur(hsl) {

    // Adjust the saturation. 
    const colorful = 2 * hsl[1] * hsl[2];
    const s = hsl[1] * (1 - hsl[2]) * 3;
    
    return [hsl[0],s,hsl[2]];
    
  }

  // Set up the canvas.
  const img = document.getElementById("blurImg");
  const canvas = document.getElementById("mainCanvas");

  const w = img.naturalWidth;
  const h = img.naturalHeight;

  canvas.style.width  = w + "px";
  canvas.style.height = h + "px";
  canvas.width = w;
  canvas.height = h;

  const context = canvas.getContext("2d");
  context.clearRect( 0, 0, w, h );
  context.drawImage( img, 0, 0 );
  
  // Get the image data from the context.
  var imageData = context.getImageData(0,0,w,h);
  var pix = imageData.data;
  
  // Set the image function, if any.
  var imageFunc;
  var style = "${style}";
  if (style == "dark") { imageFunc = darkBlur; }
  else if (style == "light") { imageFunc = lightBlur; }

  for (let i=0; i < pix.length; i+=4) {

    // Convert to HSL.
    let hsl = rgbToHsl(pix[i],pix[i+1],pix[i+2]);
    
    // Apply the image function if it exists.
    if (imageFunc) { hsl = imageFunc(hsl); }
  
    // Convert back to RGB.
    const rgb = hslToRgb(hsl[0], hsl[1], hsl[2]);
  
    // Put the values back into the data.
    pix[i] = rgb[0];
    pix[i+1] = rgb[1];
    pix[i+2] = rgb[2];

  }

  // Draw over the old image.
  context.putImageData(imageData,0,0);

  // Blur the image.
  stackBlurCanvasRGB("mainCanvas", 0, 0, w, h, ${blur});
  
  // Perform the additional processing for dark images.
  if (style == "dark") {
  
    // Draw the hard light box over it.
    context.globalCompositeOperation = "hard-light";
    context.fillStyle = "rgba(55,55,55,0.2)";
    context.fillRect(0, 0, w, h);

    // Draw the soft light box over it.
    context.globalCompositeOperation = "soft-light";
    context.fillStyle = "rgba(55,55,55,1)";
    context.fillRect(0, 0, w, h);

    // Draw the regular box over it.
    context.globalCompositeOperation = "source-over";
    context.fillStyle = "rgba(55,55,55,0.4)";
    context.fillRect(0, 0, w, h);
  
  // Otherwise process light images.
  } else if (style == "light") {
    context.fillStyle = "rgba(255,255,255,0.4)";
    context.fillRect(0, 0, w, h);
  }

  // Return a base64 representation.
  canvas.toDataURL(); 
  `
  
  // Convert the images and create the HTML.
  let blurImgData = Data.fromPNG(img).toBase64String()
  let html = `
  <img id="blurImg" src="data:image/png;base64,${blurImgData}" />
  <canvas id="mainCanvas" />
  `
  
  // Make the web view and get its return value.
  let view = new WebView()
  await view.loadHTML(html)
  let returnValue = await view.evaluateJavaScript(js)
  
  // Remove the data type from the string and convert to data.
  let imageDataString = returnValue.slice(22)
  let imageData = Data.fromBase64String(imageDataString)
  
  // Convert to image and crop before returning.
  let imageFromData = Image.fromData(imageData)
  return cropImage(imageFromData)
}

// Pixel sizes and positions for widgets on all supported phones.
function phoneSizes() {
  let phones = {  
   
    // 12 Pro Max
    "2778": {
      small:  510,
      medium: 1092,
      large:  1146,
      left:  96,
      right: 678,
      top:    246,
      middle: 882,
      bottom: 1518
    },
  
    // 12 and 12 Pro
    "2532": {
      small:  474,
      medium: 1014,
      large:  1062,
      left:  78,
      right: 618,
      top:    231,
      middle: 819,
      bottom: 1407
    },
  
    // 11 Pro Max, XS Max
    "2688": {
      small:  507,
      medium: 1080,
      large:  1137,
      left:  81,
      right: 654,
      top:    228,
      middle: 858,
      bottom: 1488
    },
  
    // 11, XR
    "1792": {
      small:  338,
      medium: 720,
      large:  758,
      left:  55,
      right: 437,
      top:    159,
      middle: 579,
      bottom: 999
    },
    
    
    // 11 Pro, XS, X, 12 mini
    "2436": {
     
      x: {
        small:  465,
        medium: 987,
        large:  1035,
        left:  69,
        right: 591,
        top:    213,
        middle: 783,
        bottom: 1353,
      },
      
      mini: {
        small:  465,
        medium: 987,
        large:  1035,
        left:  69,
        right: 591,
        top:    231,
        middle: 801,
        bottom: 1371,
      }
      
    },
  
    // Plus phones
    "2208": {
      small:  471,
      medium: 1044,
      large:  1071,
      left:  99,
      right: 672,
      top:    114,
      middle: 696,
      bottom: 1278
    },
    
    // SE2 and 6/6S/7/8
    "1334": {
      small:  296,
      medium: 642,
      large:  648,
      left:  54,
      right: 400,
      top:    60,
      middle: 412,
      bottom: 764
    },
    
    
    // SE1
    "1136": {
      small:  282,
      medium: 584,
      large:  622,
      left: 30,
      right: 332,
      top:  59,
      middle: 399,
      bottom: 399
    },
    
    // 11 and XR in Display Zoom mode
    "1624": {
      small: 310,
      medium: 658,
      large: 690,
      left: 46,
      right: 394,
      top: 142,
      middle: 522,
      bottom: 902 
    },
    
    // Plus in Display Zoom mode
    "2001" : {
      small: 444,
      medium: 963,
      large: 972,
      left: 81,
      right: 600,
      top: 90,
      middle: 618,
      bottom: 1146
    },
  }
  return phones
}

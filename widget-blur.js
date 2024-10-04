// Variables used by Scriptable.
// These must be at the very top of the file. Do not edit.
// icon-color: yellow; icon-glyph: magic;

// This script was created by Max Zeryck.

// The amount of blurring. Default is 150.
const blurRadius = 150
 
// Determine if user has taken the screenshot.
let message = "Before you start, go to your home screen and enter wiggle mode. Scroll to the empty page on the far right and take a screenshot."
const actions = {select: "Continue to select image",exit: "Exit to take screenshot",update: "Update code"}
const actionOptions = [actions.select, actions.exit, actions.update]
const actionResponse = await generateAlert(message,actionOptions)

if (actionResponse.value == actions.exit) return
if (actionResponse.value == actions.update) {

  // Determine if the user is using iCloud.
  let files = FileManager.local()
  const iCloudInUse = files.isFileStoredIniCloud(module.filename)
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
  return await generateAlert(message,["OK"])
}
  
// Get screenshot and determine phone size.
let img = await Photos.fromLibrary()
const height = img.size.height
let phone = phoneSizes(height)
if (!phone) {
  message = "It looks like you selected an image that isn't an iPhone screenshot, or your iPhone is not supported. Try again with a different image."
  return await generateAlert(message,["OK"])
}

// Extra setup needed for 2436-sized phones.
if (height == 2436) {

  const files = FileManager.local()
  const cachePath = files.joinPath(files.libraryDirectory(), "mz-phone-type")

  // If we already cached the phone size, load it.
  if (files.fileExists(cachePath)) {
    const type = files.readString(cachePath)
    phone = phone[type]
  
  // Otherwise, prompt the user.
  } else { 
    message = "What type of iPhone do you have?"
      const typeOptions = [{key: "mini", value: "iPhone 13 mini or 12 mini"}, {key: "x", value: "iPhone 11 Pro, XS, or X"}]
      const typeResponse = await generateAlert(message, typeOptions)
      phone = phone[typeResponse.key]
      files.writeString(cachePath, typeResponse.key)
  }
}

// If supported, check whether home screen has text labels or not.
if (phone.text) {
  message = "What size are your home screen icons?"
  const textOptions = [{key: "text", value: "Small (has labels)"},{key: "notext", value: "Large (no labels)"}]
  const textResponse = await generateAlert(message, textOptions)
  phone = phone[textResponse.key]
}

// Prompt for widget size.
message = "What size of widget are you creating?"
const sizes = {small: "Small", medium: "Medium", large: "Large"}
const sizeOptions = [sizes.small, sizes.medium, sizes.large]
const size = (await generateAlert(message,sizeOptions)).value

// Prompt for position.
message = "What position will it be in?"
message += (height == 1136 ? " (Note that your device only supports two rows of widgets, so the middle and bottom options are the same.)" : "")

let positions
if (size == sizes.small) {
  positions = ["Top left","Top right","Middle left","Middle right","Bottom left","Bottom right"]
} else if (size == sizes.medium) {
  positions = ["Top","Middle","Bottom"]
} else if (size == sizes.large) {
  positions = [{key: "top", value: "Top"},{key: "middle", value: "Bottom"}]
}
const position = (await generateAlert(message,positions)).key

// Determine image crop based on the size and position.
const crop = { 
  w: (size == sizes.small ? phone.small : phone.medium),
  h: (size == sizes.large ? phone.large : phone.small),
  x: (size == sizes.small ? phone[position.split(" ")[1]] : phone.left),
  y: phone[position.toLowerCase().split(" ")[0]]
}

// Prompt for blur style and blur the image.
message = "Do you want a fully transparent widget, or a translucent blur effect?"
const blurs = {none: "Transparent (no blur)",light: "Light mode blur",dark: "Dark mode blur",blur: "Just blur"}
const blurOptions = [blurs.none, blurs.light, blurs.dark, blurs.blur]
const blurResponse = await generateAlert(message,blurOptions)

if (blurResponse.value != blurs.none) img = await blurImage(img,blurResponse.key)

// Crop the image.
const draw = new DrawContext()
draw.size = new Size(crop.w, crop.h)
draw.drawImageAtPoint(img,new Point(-crop.x, -crop.y))  
img = draw.getImage()

// Finalize and export the image.
message = "Your widget background is ready. Choose where to save the image:"
const exports = {photos: "Export to Photos", files: "Export to Files"}
const exportOptions = [exports.photos, exports.files]
const exportValue = (await generateAlert(message,exportOptions)).value

if (exportValue == exports.photos) {
  Photos.save(img)
} else if (exportValue == exports.files) {
  await DocumentPicker.exportImage(img)
}

Script.complete()

// Generate an alert with the provided array of options.
async function generateAlert(message,options) {
  
  const alert = new Alert()
  alert.message = message
  
  const isObject = options[0].value
  for (const option of options) {
  	alert.addAction(isObject ? option.value : option)
  }
  
  const index = await alert.presentAlert()
  return { 
  	index: index, 
  	value: isObject ? options[index].value : options[index],
  	key: isObject ? options[index].key : options[index]
  }
}

// Blur an image using the optional specified style.
async function blurImage(img,style) {
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
  
  // Capture variables from Scriptable.
  const style = "${style}"
  const blurRadius = ${blurRadius}

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
  const imageData = context.getImageData(0,0,w,h);
  const pix = imageData.data;
  
  // Set the image function, if any.
  let imageFunc;
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
  stackBlurCanvasRGB("mainCanvas", 0, 0, w, h, blurRadius);
  
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
  const blurImgData = Data.fromPNG(img).toBase64String()
  const html = `
  <img id="blurImg" src="data:image/png;base64,${blurImgData}" />
  <canvas id="mainCanvas" />
  `
  
  // Make the web view and get its return value.
  const view = new WebView()
  await view.loadHTML(html)
  const returnValue = await view.evaluateJavaScript(js)
  
  // Remove the data type from the string and convert to data.
  const imageData = Data.fromBase64String(returnValue.slice(22))
  
  // Convert to image and return.
  return Image.fromData(imageData)
}

/*

How phoneSizes() works
======================
This function takes the pixel height value of an iPhone screenshot and provides information about the sizes and locations of widgets on that iPhone. The "text" and "notext" properties refer to whether the home screen is set to Small (with text labels) or Large (no text labels).

The remaining properties can be determined using a single screenshot of a home screen with 6 small widgets on it. You can see a visual representation of these properties by viewing this image: https://github.com/mzeryck/Widget-Blur/blob/main/measurements.png

* The following properties define widget sizes:
	- small: The height of a small widget.
	- medium: From the left of the leftmost widget to the right of the rightmost widget.
	- large: From the top of a widget in the top row to the bottom of a widget in the middle row.

* The following properties measure the distance from the left edge of the screen: 
	- left: The distance to the left edge of widgets in the left column.
	- right: The distance to the left edge of widgets in the right column.
	
* The following properties measure the distance from the top edge of the screen: 
	- top: The distance to the top edge of widgets in the top row.
	- middle: The distance to the top edge of widgets in the middle row.
	- bottom: The distance to the top edge of widgets in the bottom row.

*/
function phoneSizes(inputHeight) {
  return { 
  
    /*
  
    Supported devices
    =================
    The following device measurements have been confirmed in iOS 18.
  
    */
  
    // 16 Pro Max
    "2868": {
      text: {
        small: 510,
        medium: 1092,
        large: 1146,
        left: 114,
        right: 696,
        top: 276,
        middle: 912,
        bottom: 1548
      },
      notext: {
        small: 530,
        medium: 1138,
        large: 1136,
        left: 91,
        right: 699,
        top: 276,
        middle: 882,
        bottom: 1488
      } 
    },
    
    // 16 Plus, 15 Plus, 15 Pro Max, 14 Pro Max
    "2796": {
      text: {
        small: 510,
        medium: 1092,
        large: 1146,
        left: 98,
        right: 681,
        top: 252,
        middle: 888,
        bottom: 1524
      },
      notext: {
        small: 530,
        medium: 1139,
        large: 1136,
        left: 75,
        right: 684,
        top: 252,
        middle: 858,
        bottom: 1464
      }
    },
    
    // 16 Pro
    "2622": {
      text: {
        small: 486,
        medium: 1032,
        large: 1098,
        left: 87,
        right: 633,
        top: 261,
        middle: 872,
        bottom: 1485
      },
      notext: {
        small: 495,
        medium: 1037,
        large: 1035,
        left: 84,
        right: 626,
        top: 270,
        middle: 810,
        bottom: 1350
      } 
    },

    // 16, 15, 15 Pro, 14 Pro
    "2556": {
      text: {
        small: 474,
        medium: 1017,
        large: 1062,
        left: 81,
        right: 624,
        top: 240,
        middle: 828,
        bottom: 1416
      },
      notext: {
        small: 495,
        medium: 1047,
        large: 1047,
        left: 66,
        right: 618,
        top: 243,
        middle: 795,
        bottom: 1347
      }
    },
  
    // SE3, SE2
    "1334": {
      text: {
        small: 296,
        medium: 642,
        large: 648,
        left: 54,
        right: 400,
        top: 60,
        middle: 412,
        bottom: 764
      },
      notext: {
        small: 309,
        medium: 667,
        large: 667,
        left: 41,
        right: 399,
        top: 67,
        middle: 425,
        bottom: 783
      }
    },
    
    /*
  
    In-limbo devices
    =================
    The following device measurements were confirmed in older versions of iOS.
    Please comment if you can confirm these for iOS 18.
  
    */
     
    // 14 Plus, 13 Pro Max, 12 Pro Max
    "2778": {
      small: 510,
      medium: 1092,
      large: 1146,
      left: 96,
      right: 678,
      top: 246,
      middle: 882,
      bottom: 1518
    },

    // 11 Pro Max, XS Max
    "2688": {
      small: 507,
      medium: 1080,
      large: 1137,
      left: 81,
      right: 654,
      top: 228,
      middle: 858,
      bottom: 1488
    },
    
    // 14, 13, 13 Pro, 12, 12 Pro
    "2532": {
      small: 474,
      medium: 1014,
      large: 1062,
      left: 78,
      right: 618,
      top: 231,
      middle: 819,
      bottom: 1407
    },

    // 13 mini, 12 mini / 11 Pro, XS, X
    "2436": {
      x: {
        small: 465,
        medium: 987,
        large: 1035,
        left: 69,
        right: 591,
        top: 213,
        middle: 783,
        bottom: 1353
      },
      mini: {
        small: 465,
        medium: 987,
        large: 1035,
        left: 69,
        right: 591,
        top: 231,
        middle: 801,
        bottom: 1371
      } 
    },
    
    // 11, XR
    "1792": {
      small: 338,
      medium: 720,
      large: 758,
      left: 55,
      right: 437,
      top: 159,
      middle: 579,
      bottom: 999
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
    
    /*
  
    Older devices
    =================
    The following devices cannot be updated to iOS 18 or later.
  
    */
  
    // Home button Plus phones
    "2208": {
      small: 471,
      medium: 1044,
      large: 1071,
      left: 99,
      right: 672,
      top: 114,
      middle: 696,
      bottom: 1278
    },
    
    // Home button Plus in Display Zoom mode
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

    // SE1
    "1136": {
      small: 282,
      medium: 584,
      large: 622,
      left: 30,
      right: 332,
      top: 59,
      middle: 399,
      bottom: 399
    }
  }[inputHeight]
}

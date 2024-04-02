console.log("This is running in the MAIN world, hopefully before all other scripts!");

// // const ORIG_XMLHttpRequest = XMLHttpRequest;
// window.ORIG_XMLHttpRequest = XMLHttpRequest;

// // Proxy XMLHttpRequest, to intercept assignments to onreadystatechange:
// const xhrObjectHandler = {
//     // set(target, prop, value) {
//     //     console.log(`xhrObjectHandler: .${prop} being set to ${value} on target ${target}!`);
//     //     return target[prop] = value;
//     // }
//     // get(target, prop, receiver) {
//     //     // By default, it looks like Reflect.get(target, prop, receiver)
//     //     // which has a different value of `this`
//     //     return target[prop];
//     // },
//     get(target, prop, receiver) {
//         console.log(`xhrObjectHandler: get(prop=${prop}) called on target`, target, '!');
//         const value = target[prop];
//         if (value instanceof Function) {
//             console.log(`xhrObjectHandler: get(prop=${prop}) called on target`, target, ': About to handle function as special case');
//             return function (...args) {
//                 return value.apply(this === receiver ? target : this, args);
//             };
//         }
//         console.log(`xhrObjectHandler: get(prop=${prop}) called on target`, target, ': About to return ordinary value ', value);
//         return value;
//     },
// };

// const xhrClassHandler = {
//     construct(target, args) {
//         console.log(`xhrClassHandler: Constructing new XHR object with args`, args, `for target ${target}!`);
//         // return new target(...args);
//         // return new Proxy(new target(...args), xhrObjectHandler);
//         return new Proxy(new ORIG_XMLHttpRequest(...args), xhrObjectHandler);
//     }
// };

// xhrProxy = new Proxy(XMLHttpRequest, xhrClassHandler);
// window.XMLHttpRequest = xhrProxy;      // Sparks fly!

// Below proxying of XMLHttpRequest taken from https://stackoverflow.com/a/77456512/47984
"use strict"

window.XMLHttpRequest = class XMLHttpRequest {
  static _originalXMLHttpRequest = window.XMLHttpRequest

  constructor(...args) {
    this._XMLHttpRequestInstance = new XMLHttpRequest._originalXMLHttpRequest(...args)

    // If a return statement is used in a constructor with an object,
    // the object will be returned instead of `this`.
    // https://javascript.info/constructor-new#return-from-constructors
    return new Proxy(this, {
      get(instance, property) {
        if (property === "responseText") {
            console.trace("Handler: get(responseText)!");
          // Modify the response string
          // `this` doesn't work inside an object, use `instance` instead
        //   return instance._XMLHttpRequestInstance.responseText.replace("Barbarian", "IT WORKED!")
        return instance._XMLHttpRequestInstance.responseText.replace('"title":"', '"title":"IT WORKED!')

          // Or return whatever you want
          return "whatever you wanted"
        }

        // Functions won't work without having `_XMLHttpRequestInstance` as `this`
        const value = instance._XMLHttpRequestInstance[property]
        return value instanceof Function ? value.bind(instance._XMLHttpRequestInstance) : value
      },
      set(instance, property, value) {
        if (property === 'onreadystatechange') {
            console.log(`Intercepting assignment to onreadystatechange!`);
            const origFunc = value;
            value = function (...args) {
                console.log("This is running just before the readystatechange handler!");
                // return 42;      //DEBUG


                const result = origFunc(...args);
                //TODO: Handle case where result is a Promise
                console.log("This is running just after the readystatechange handler!");
                return result;
            }

            // console.log("About to test-run the new handler:");
            // value(3, 4, 5);
            // console.log("Test run finished.");

            // console.log("Setting it the hard way...");
            // // instance.onreadystatechange = value;
            // instance._XMLHttpRequestInstance.onreadystatechange = value;
            // console.log("Setting it the hard way done.");
            // return true
            // // return false
        }
        // `this` doesn't work inside an object, use `instance` instead
        instance._XMLHttpRequestInstance[property] = value
        return true
      },
      defineProperty(target, property, attributes) {
        console.log("Intercepting defineProperty(", property, ").");
        return Reflect.defineProperty(target._XMLHttpRequestInstance, property, attributes);
      },
      deleteProperty(target, property) {
        console.log("Intercepting deleteProperty(", property, ").");
        return Reflect.deleteProperty(target._XMLHttpRequestInstance, property);
      },
      has(target, property) {
        console.log("Intercepting has(", property, ").");
        return Reflect.has(target._XMLHttpRequestInstance, property);
      },
      getOwnPropertyDescriptor(target, property) {
        console.log("Intercepting getOwnPropertyDescriptor(", property, ").");
        return Reflect.getOwnPropertyDescriptor(target._XMLHttpRequestInstance, property);
      },
      getPrototypeOf(target) {
        console.log("Intercepting getPrototypeOf().");
        return Reflect.getPrototypeOf(target._XMLHttpRequestInstance);
      },
      isExtensible(target) {
        console.log("Intercepting isExtensible().");
        return Reflect.isExtensible(target._XMLHttpRequestInstance);
      },
      ownKeys(target) {
        console.log("Intercepting ownKeys().");
        return Reflect.ownKeys(target._XMLHttpRequestInstance);
      },
      preventExtensions(target) {
        console.log("Intercepting preventExtensions().");
        return Reflect.preventExtensions(target._XMLHttpRequestInstance);
      },
      setPrototypeOf(target, value) {
        console.log("Intercepting setPrototypeOf().");
        return Reflect.setPrototypeOf(target._XMLHttpRequestInstance, value);
      }
    })
  }
}

// Try running it a bit later
function later() {

// Quick test (for some reason the XMLHttpRequest calls below aren't intercepted, so this gives a false negative; later calls are correctly intercepted)
const exampleUrl = 'http://localhost:8080/api/v1/movie/66';
console.log(`About to construct XHR for ${exampleUrl}`);
const xhr = new XMLHttpRequest();
// const xhr = new window.XMLHttpRequest();
console.log(`Constructed XHR for ${exampleUrl}`);
xhr.open('GET', exampleUrl);
console.log(`Called open() on XHR for ${exampleUrl}`);
xhr.somedummyproperty = 123;
console.log(`Assigned to somedummyproperty of XHR for ${exampleUrl}`);
const hasIt = 'somedummyproperty' in xhr;
console.log(`somedummyproperty in xhr for ${exampleUrl}: ${hasIt}`);
delete xhr.somedummyproperty;
console.log("Deleted somedummyproperty from XHR for ${exampleUrl}");
const hasItAfterDeleting = 'somedummyproperty' in xhr;
console.log(`somedummyproperty in xhr for ${exampleUrl}: ${hasItAfterDeleting}`);
xhr.onreadystatechange = function (e) {
    console.log("readystatechange happened: ", e.target.readyState);
    if (e.target.readyState === 4) {
        // console.log("Contents:", e.target.responseText);
        console.log("Contents:", xhr.responseText);
    }
};
console.log(`Assigned to onreadystatechange of XHR for ${exampleUrl}`);
xhr.send();
console.log(`Called send() on XHR for ${exampleUrl}`);

}

// console.log("Setting up the example URL to be loaded at DOMContentLoaded time");
// document.addEventListener('DOMContentLoaded', later());
console.log("Running the example URL XHR immediately...");
later();
console.log("Finished running the example URL XHR immediately.");

console.log("We have proxied XMLHttpRequest!");

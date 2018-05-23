window.vdom = (function () {
    const htmlApi = {
        createTextNode: function (text) {
            return document.createTextNode(text)
        },
        createElement: function (tagName) {
            return document.createElement(tagName)
        },
        createComment: function (text) {
            return document.createComment(text)
        },
        updateTextNode: function (element, text) {
            element.nodeValue = text
        },
        setAttributes: function (element, props, oldProps) {
            oldProps = oldProps || {}
            const keys = Object.keys(props)
            for (let key in oldProps) {
                if (!(key in props)) {
                    keys.push(key)
                }
            }

            for (const key of keys) {
                const newProp = props[key]
                const oldProp = oldProps[key]
                if (newProp == null) {
                    element.removeAttribute(key)
                } else if (newProp != oldProp) {
                    if (key.startsWith('on')) {
                        element[key.toLowerCase()] = newProp
                    } else {
                        element.setAttribute(key, newProp)
                    }
                }
            }
        },
        appendChild: function (element, child) {
            element.appendChild(child)
        },
        insertChild: function (dom, child, index, ref) {
            const newIndex = ref(index, dom.childNodes.length)
            if (dom.childNodes[newIndex]) {
                dom.insertBefore(child, dom.childNodes[newIndex])
            } else {
                dom.appendChild(child)
            }
        },
        insertBefore: function (parent, insertDom, child) {
            parent.insertBefore(insertDom, child)
        },
        remove: function (dom) {
            dom.remove()
        }
    }



    function patch (newVnode, oldVnode) {
        let dom = null
        if (newVnode == null) {
            return dom
        }
        if (oldVnode && newVnode.tag && newVnode.tag === oldVnode.tag) {
            if (newVnode.isText) {
                dom = oldVnode.dom
                newVnode.dom = dom
                if (newVnode.text != oldVnode.text) {
                    htmlApi.updateTextNode(dom, newVnode.text)
                }
            } else if (typeof newVnode.tag === 'string') {
                dom = oldVnode.dom
                newVnode.dom = dom
                htmlApi.setAttributes(dom, newVnode.props, oldVnode.props)
                patchChildren(newVnode.content, oldVnode.content, dom)
            } else {
                const component = oldVnode.component
                newVnode.component = component
                dom = component[syms.updateUI](newVnode.props, newVnode.content)
            }
        } else {
            dom = createDom(newVnode)
        }

        return dom
    }

    function insertCb (vnode) {
        if (vnode.animation && vnode.animation.inserted) {
            const setAnimation = vnode.animation.inserted
            setAnimation(vnode)
        }
    }

    function createDom (vnode) {
        if (vnode.isText) {
            const element = htmlApi.createTextNode(vnode.text)
            vnode.dom = element
            return element
        } else if (isBaseType(vnode)) {
            return htmlApi.createTextNode(vnode.toString())
        } else if (typeof vnode.tag === 'string') {
            const element = htmlApi.createElement(vnode.tag)
            vnode.dom = element
            htmlApi.setAttributes(element, vnode.props, null)
            if (vnode.content && vnode.content.length > 0) {
                for (let child of vnode.content) {
                    htmlApi.appendChild(element, createDom(child))
                }
            }
            taskManager.addCallback(vnode, insertCb)
            return element
        } else {
            const component = new vnode.tag()
            component.key = vnode.key
            vnode.component = component
            return component[syms.renderUI](vnode.props, vnode.content)
        }
    }

    function removeCb (vnode) {
        if (vnode.animation && vnode.animation.remove) {
            const setAnimation = vnode.animation.remove
            setAnimation(vnode, function () {
                vnode.dom.remove()
            })
        } else {
            vnode.dom.remove()
        }
    }

    function patchChildren (content, oldContent, dom) {
        content = content ? content.slice(0) : []
        oldContent = oldContent ? oldContent.slice(0) : []
        const leftSide = createSide(content, oldContent, i => i, dom)
        const rightSide = createSide(content, oldContent, (i, length) => length - i - 1, dom)

        while (true) {
            const leftMatch = leftSide.getMatch()
            const rightMatch = rightSide.getMatch()
            if (leftMatch == null && rightMatch == null) {
                break
            } else if (leftMatch == null) {
                rightSide.apply()
            } else if (rightMatch == null) {
                leftSide.apply()
            } else {
                if (leftMatch.index >= rightMatch.index) {
                    leftSide.apply()
                    rightSide.updateIndex(leftMatch.index)
                } else {
                    rightSide.apply()
                    leftSide.updateIndex(rightMatch.index)
                }
            }
        }
        if (oldContent.length > 0) {
            for (let oldVnode of oldContent) {
                if (oldVnode.dom) {
                    taskManager.addCallback(oldVnode, removeCb)
                } else if (oldVnode.component) {
                    oldVnode.component[syms.destroy]()
                }
            }
        }
    }



    function createSide (targetArray, oldArray, ref, dom) {
        let targetIndex = -1
        return {
            match: null, //{node, oldNode, index}
            getMatch: function () {
                if (this.match != null) {
                    return this.match
                } else {
                    while (targetArray.length > 0) {
                        const node = targetArray.splice(ref(0, targetArray.length), 1)[0]
                        targetIndex++
                        
                        const match = findMatch(node, oldArray, ref)
                        if (match == null) {
                            htmlApi.insertChild(dom, patch(node, null), targetIndex, ref)
                        } else if(match.index == 0) {
                            patch(node, match.oldNode)
                            remove(oldArray, match.index, ref)
                            continue
                        } else {
                            patch(node, match.oldNode)
                            this.match = match
                            return match
                        }
                    }
                    return null
                }
            },
            apply: function () {
                const oldChild = this.match.oldNode.dom || this.match.oldNode.component[syms.dom]
                htmlApi.insertChild(dom, oldChild, targetIndex, ref)
                remove(oldArray, this.match.index, ref)
                this.match = null
            },
            updateIndex: function (anotherIndex) {
                if (anotherIndex + this.match.index + 2 > oldArray.length) {
                    this.match.index--
                    if (this.match.index == 0) {
                        this.match = null
                    }
                }
            }
        }
    }

    function isBaseType (node) {
        const type = typeof node
        if (type == 'string' || type == 'boolean' || type == 'number') {
            return true
        } else {
            return false
        }
    }

    function findMatch (vnode, array, ref) {
        if (!array.markSet) {
            array.markSet = new Set()
        }
        let match = {
            node: vnode,
            oldNode: null,
            index: -1
        }

        for (let i = 0; i < array.length; i++) {
            let oldNode = array[ref(i, array.length)]

            if (array.markSet.has(oldNode)) {
                continue
            }
            if (vnode.isText && oldNode.isText) {
                match.oldNode = oldNode
                match.index = i
                if (vnode.text == oldNode.text) {
                    break
                }
            } else if (vnode.key === oldNode.key && vnode.tag === oldNode.tag) {
                match.oldNode = oldNode
                match.index = i
                break
            } else if (vnode.tag === oldNode.tag && vnode.props.id && vnode.props.id == oldNode.props.id) {
                match.oldNode = oldNode
                match.index = i
                break
            } else if (vnode.tag === oldNode.tag && !match.oldNode) {
                match.oldNode = oldNode
                match.index = i
            }
        }

        if (match.oldNode) {
            array.markSet.add(match.oldNode)
            return match
        } else {
            return null
        }
    }

    function remove (array, index, ref) {
        let idx = ref(index, array.length)
        let x = array[idx]
        if (array.markSet) {
            array.markSet.delete(x)
        }
        array.splice(idx, 1)
    }

    const syms = {
        vnode: Symbol.for('vnode'),
        newState: Symbol.for('newState'),
        dom: Symbol.for('dom'),
        updateUI: Symbol.for('updateUI'),
        destroy: Symbol.for('destroy')
    }

    class Component {
        constructor () {
            //scope, position, vnode, element
            this[syms.vnode] = null
            this[syms.newState] = null
            this[syms.dom] = htmlApi.createComment(`${this.constructor.name} key=${this.key}`)
            this.state = null
        }

        render () {
            return null
        }

        unmount () {

        }

        shouldUpdate (newProps, newState, newContent) {
            return true
        }

        setState (state) {
            if (!this[syms.newState]) {
                this[syms.newState] = {}
            }
            Object.assign(this[syms.newState], state)
            taskManager.commit(this)
        }

        render () {
            return null
        }

        [syms.destroy] () {
            const remove = () => {
                this[syms.dom].remove()
                this.unmount()
            }
            if (this[syms.vnode] && this[syms.vnode].animation && 
                this[syms.vnode].animation.remove) {
                const onRemove = this[syms.vnode].animation.remove
                onRemove(this[syms.vnode]).onfinish(remove)
            } else {
                remove()
            }
            
        }

        [syms.updateUI] (props, content) {
            const newState = this[syms.newState] ? Object.assign({}, this.state, this[syms.newState]) : this.state
            const shouldUpdate = this.shouldUpdate(props, newState, content)
            this.state = newState
            this[syms.newState] = null

            if (shouldUpdate) {
                this[syms.renderUI](props, content)
            } else {
                this.props = props
                this.content = content
            }
            taskManager.removeComponent(this)
            return this[syms.dom]
        }

        [syms.renderUI] (props, content) {
            this.props = props
            this.content = content
            const oldVnode = this[syms.vnode]
            const newVnode = this.render()
            const insideDom = patch(newVnode, oldVnode)
            this[syms.vnode] = newVnode
            if (insideDom == null) {
                insideDom = htmlApi.createComment(`${this.constructor.name} key=${this.key}`)
            }
            if (insideDom != this[syms.dom]) {
                const parentDom = this[syms.dom].parentNode
                if (parentDom) {
                    htmlApi.insertBefore(parentDom, insideDom, this[syms.dom])
                }
                htmlApi.remove(this[syms.dom])
                this[syms.dom] = insideDom
            }
            
            return this[syms.dom]
        }
    }


    class TaskManager {
        constructor () {
            this.updateList = []
            this.callbackList = []
            this.updateSet = new Set()
            this.isCommited = false
            this.promise = Promise.resolve()
        }

        commit (component) {
            if (!this.updateSet.has(component)) {
                this.updateSet.add(component)
                this.updateList.push(component)
            }
            if (!this.isCommited) {
                this.isCommited = true
                this.promise.then(() => {
                    this.run()
                    this.clear()
                })
            }
        }

        clear () {
            this.updateList = []
            this.callbackList = []
            this.updateSet.clear()
            this.isCommited = false
        }

        run () {
            this.updateList.forEach((component) => {
                if (this.updateSet.has(component)) {
                    component[syms.updateUI](component.props, component.content)
                    this.removeComponent(component)
                }
                
            })

            this.callbackList.forEach(obj => {
                obj.cb(obj.vnode)
            })

            this.clear()
        }

        removeComponent (component) {
            if (this.updateSet.has(component)) {
                this.updateSet.delete(component)
            }
        }
        
        addCallback (vnode, cb) {
            this.callbackList.push({vnode, cb})
            if (!this.isCommited) {
                this.isCommited = true
                this.promise.then(() => {
                    this.run()
                    this.clear()
                })
            }
        }

    }

    const taskManager = new TaskManager()
    const textSymbol = Symbol.for('text')
    function h (tag, props, contArg) {
        const length = arguments.length - 2
        let content = []
        if (length == 1) {
            if (Array.isArray(contArg)) {
                content = contArg
            } else {
                content = [contArg]
            }
        } else if (length > 1) {
            content = Array.prototype.slice.call(arguments, 2);
        }
        let newContent = []
        for (let i = 0; i < content.length; i++) {
            let o = content[i]
            if (o != null) {
                if (isBaseType(o)) {
                    newContent.push({
                        tag: textSymbol,
                        isText: true,
                        text: o.toString(),
                        porps: {},
                        content: null
                    })
                } else {
                    newContent.push(o)
                }
            }
        }
        const key = props && props.key
        const animation = props && props.animation
        if (props) {
            delete(props.animation)
        }
        
        return {
            key,
            tag,
            animation,
            props: props || {},
            content: newContent,
            isText: false
        }
    }

    function mount (elm, component) {
        htmlApi.appendChild(elm, component[syms.renderUI]())
    }

    return {
        Component,
        mount,
        h
    }
})()

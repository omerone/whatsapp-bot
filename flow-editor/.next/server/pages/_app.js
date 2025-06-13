"use strict";
/*
 * ATTENTION: An "eval-source-map" devtool has been used.
 * This devtool is neither made for production nor for readable output files.
 * It uses "eval()" calls to create a separate source file with attached SourceMaps in the browser devtools.
 * If you are trying to read the output file, select a different devtool (https://webpack.js.org/configuration/devtool/)
 * or disable the default devtool with "devtool: false".
 * If you are looking for production-ready output files, see mode: "production" (https://webpack.js.org/configuration/mode/).
 */
(() => {
var exports = {};
exports.id = "pages/_app";
exports.ids = ["pages/_app"];
exports.modules = {

/***/ "./src/context/FlowContext.tsx":
/*!*************************************!*\
  !*** ./src/context/FlowContext.tsx ***!
  \*************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

eval("__webpack_require__.r(__webpack_exports__);\n/* harmony export */ __webpack_require__.d(__webpack_exports__, {\n/* harmony export */   FlowProvider: () => (/* binding */ FlowProvider),\n/* harmony export */   useFlow: () => (/* binding */ useFlow)\n/* harmony export */ });\n/* harmony import */ var react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! react/jsx-dev-runtime */ \"react/jsx-dev-runtime\");\n/* harmony import */ var react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_0__);\n/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! react */ \"react\");\n/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_1___default = /*#__PURE__*/__webpack_require__.n(react__WEBPACK_IMPORTED_MODULE_1__);\n\n\nconst FlowContext = /*#__PURE__*/ (0,react__WEBPACK_IMPORTED_MODULE_1__.createContext)(undefined);\nconst FlowProvider = ({ children })=>{\n    const [flow, setFlow] = (0,react__WEBPACK_IMPORTED_MODULE_1__.useState)({\n        metadata: {\n            company_name: \"\",\n            version: \"1.0.0\",\n            last_updated: new Date().toISOString()\n        },\n        configuration: {\n            rules: {},\n            client_management: {}\n        },\n        start: \"\",\n        steps: {}\n    });\n    const [history, setHistory] = (0,react__WEBPACK_IMPORTED_MODULE_1__.useState)([\n        {\n            flow,\n            timestamp: Date.now()\n        }\n    ]);\n    const [currentHistoryIndex, setCurrentHistoryIndex] = (0,react__WEBPACK_IMPORTED_MODULE_1__.useState)(0);\n    const pushHistory = (0,react__WEBPACK_IMPORTED_MODULE_1__.useCallback)((newFlow)=>{\n        const newHistory = history.slice(0, currentHistoryIndex + 1);\n        newHistory.push({\n            flow: JSON.parse(JSON.stringify(newFlow)),\n            timestamp: Date.now()\n        });\n        // Keep only last 50 states to prevent memory issues\n        if (newHistory.length > 50) {\n            newHistory.shift();\n        }\n        setHistory(newHistory);\n        setCurrentHistoryIndex(newHistory.length - 1);\n    }, [\n        history,\n        currentHistoryIndex\n    ]);\n    const updateFlow = (0,react__WEBPACK_IMPORTED_MODULE_1__.useCallback)((newFlow)=>{\n        setFlow(newFlow);\n        pushHistory(newFlow);\n    }, [\n        pushHistory\n    ]);\n    const addStep = (0,react__WEBPACK_IMPORTED_MODULE_1__.useCallback)((step)=>{\n        const newFlow = {\n            ...flow,\n            steps: {\n                ...flow.steps,\n                [step.id]: step\n            }\n        };\n        if (!flow.start) {\n            newFlow.start = step.id;\n        }\n        updateFlow(newFlow);\n    }, [\n        flow,\n        updateFlow\n    ]);\n    const updateStep = (0,react__WEBPACK_IMPORTED_MODULE_1__.useCallback)((id, changes)=>{\n        if (!flow.steps[id]) return;\n        const newFlow = {\n            ...flow,\n            steps: {\n                ...flow.steps,\n                [id]: {\n                    ...flow.steps[id],\n                    ...changes\n                }\n            }\n        };\n        updateFlow(newFlow);\n    }, [\n        flow,\n        updateFlow\n    ]);\n    const deleteStep = (0,react__WEBPACK_IMPORTED_MODULE_1__.useCallback)((id)=>{\n        if (!flow.steps[id]) return;\n        const newSteps = {\n            ...flow.steps\n        };\n        delete newSteps[id];\n        // Update any references to this step\n        Object.values(newSteps).forEach((step)=>{\n            if (step.next === id) {\n                step.next = undefined;\n            }\n            if (step.branches) {\n                Object.entries(step.branches).forEach(([key, value])=>{\n                    if (value === id) {\n                        delete step.branches[key];\n                    }\n                });\n            }\n        });\n        const newFlow = {\n            ...flow,\n            steps: newSteps,\n            start: flow.start === id ? Object.keys(newSteps)[0] || \"\" : flow.start\n        };\n        updateFlow(newFlow);\n    }, [\n        flow,\n        updateFlow\n    ]);\n    const getStep = (0,react__WEBPACK_IMPORTED_MODULE_1__.useCallback)((id)=>flow.steps[id], [\n        flow\n    ]);\n    const getAllSteps = (0,react__WEBPACK_IMPORTED_MODULE_1__.useCallback)(()=>Object.values(flow.steps), [\n        flow\n    ]);\n    const importFlow = (0,react__WEBPACK_IMPORTED_MODULE_1__.useCallback)((json)=>{\n        try {\n            const newFlow = JSON.parse(json);\n            // Validate flow structure here\n            updateFlow(newFlow);\n        } catch (error) {\n            console.error(\"Error importing flow:\", error);\n            throw new Error(\"Invalid flow JSON\");\n        }\n    }, [\n        updateFlow\n    ]);\n    const exportFlow = (0,react__WEBPACK_IMPORTED_MODULE_1__.useCallback)(()=>{\n        return JSON.stringify(flow, null, 2);\n    }, [\n        flow\n    ]);\n    const updateMetadata = (0,react__WEBPACK_IMPORTED_MODULE_1__.useCallback)((changes)=>{\n        const newFlow = {\n            ...flow,\n            metadata: {\n                ...flow.metadata,\n                ...changes,\n                last_updated: new Date().toISOString()\n            }\n        };\n        updateFlow(newFlow);\n    }, [\n        flow,\n        updateFlow\n    ]);\n    const updateConfiguration = (0,react__WEBPACK_IMPORTED_MODULE_1__.useCallback)((changes)=>{\n        const newFlow = {\n            ...flow,\n            configuration: {\n                ...flow.configuration,\n                ...changes\n            }\n        };\n        updateFlow(newFlow);\n    }, [\n        flow,\n        updateFlow\n    ]);\n    const updateIntegrations = (0,react__WEBPACK_IMPORTED_MODULE_1__.useCallback)((changes)=>{\n        const newFlow = {\n            ...flow,\n            integrations: {\n                ...flow.integrations,\n                ...changes\n            }\n        };\n        updateFlow(newFlow);\n    }, [\n        flow,\n        updateFlow\n    ]);\n    const undo = (0,react__WEBPACK_IMPORTED_MODULE_1__.useCallback)(()=>{\n        if (currentHistoryIndex > 0) {\n            const newIndex = currentHistoryIndex - 1;\n            setCurrentHistoryIndex(newIndex);\n            setFlow(history[newIndex].flow);\n        }\n    }, [\n        currentHistoryIndex,\n        history\n    ]);\n    const redo = (0,react__WEBPACK_IMPORTED_MODULE_1__.useCallback)(()=>{\n        if (currentHistoryIndex < history.length - 1) {\n            const newIndex = currentHistoryIndex + 1;\n            setCurrentHistoryIndex(newIndex);\n            setFlow(history[newIndex].flow);\n        }\n    }, [\n        currentHistoryIndex,\n        history\n    ]);\n    const createNewFlow = (0,react__WEBPACK_IMPORTED_MODULE_1__.useCallback)(()=>{\n        const newFlow = {\n            metadata: {\n                company_name: \"\",\n                version: \"1.0.0\",\n                last_updated: new Date().toISOString()\n            },\n            configuration: {\n                rules: {},\n                client_management: {}\n            },\n            start: \"\",\n            steps: {}\n        };\n        updateFlow(newFlow);\n    }, [\n        updateFlow\n    ]);\n    const value = {\n        flow,\n        addStep,\n        updateStep,\n        deleteStep,\n        getStep,\n        getAllSteps,\n        importFlow,\n        exportFlow,\n        updateMetadata,\n        updateConfiguration,\n        updateIntegrations,\n        undo,\n        redo,\n        canUndo: currentHistoryIndex > 0,\n        canRedo: currentHistoryIndex < history.length - 1,\n        createNewFlow\n    };\n    return /*#__PURE__*/ (0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_0__.jsxDEV)(FlowContext.Provider, {\n        value: value,\n        children: children\n    }, void 0, false, {\n        fileName: \"/Users/omermaoz/whatssapp-bot/flow-editor/src/context/FlowContext.tsx\",\n        lineNumber: 232,\n        columnNumber: 10\n    }, undefined);\n};\nconst useFlow = ()=>{\n    const context = (0,react__WEBPACK_IMPORTED_MODULE_1__.useContext)(FlowContext);\n    if (!context) {\n        throw new Error(\"useFlow must be used within a FlowProvider\");\n    }\n    return context;\n};\n//# sourceURL=[module]\n//# sourceMappingURL=data:application/json;charset=utf-8;base64,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QixVQUFVO2dCQUNSQyxjQUFjO2dCQUNkQyxTQUFTO2dCQUNUQyxjQUFjLElBQUlDLE9BQU9DLFdBQVc7WUFDdEM7WUFDQUMsZUFBZTtnQkFDYkMsT0FBTyxDQUFDO2dCQUNSQyxtQkFBbUIsQ0FBQztZQUN0QjtZQUNBQyxPQUFPO1lBQ1BDLE9BQU8sQ0FBQztRQUNWO1FBQ0FpQixXQUFXVDtJQUNiLEdBQUc7UUFBQ1M7S0FBVztJQUVmLE1BQU1lLFFBQVE7UUFDWjVDO1FBQ0E4QjtRQUNBRztRQUNBRTtRQUNBVztRQUNBQztRQUNBQztRQUNBSztRQUNBQztRQUNBQztRQUNBQztRQUNBRTtRQUNBRTtRQUNBRSxTQUFTN0Msc0JBQXNCO1FBQy9COEMsU0FBUzlDLHNCQUFzQkosUUFBUWMsTUFBTSxHQUFHO1FBQ2hEa0M7SUFDRjtJQUVBLHFCQUFPLDhEQUFDakUsWUFBWW9FLFFBQVE7UUFBQ3BCLE9BQU9BO2tCQUFRN0M7Ozs7OztBQUM5QyxFQUFFO0FBRUssTUFBTWtFLFVBQVU7SUFDckIsTUFBTUMsVUFBVXpFLGlEQUFVQSxDQUFDRztJQUMzQixJQUFJLENBQUNzRSxTQUFTO1FBQ1osTUFBTSxJQUFJZCxNQUFNO0lBQ2xCO0lBQ0EsT0FBT2M7QUFDVCxFQUFFIiwic291cmNlcyI6WyJ3ZWJwYWNrOi8vZmxvdy1lZGl0b3IvLi9zcmMvY29udGV4dC9GbG93Q29udGV4dC50c3g/NDVmNyJdLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgUmVhY3QsIHsgY3JlYXRlQ29udGV4dCwgdXNlQ29udGV4dCwgdXNlU3RhdGUsIHVzZUNhbGxiYWNrIH0gZnJvbSAncmVhY3QnO1xuaW1wb3J0IHsgRmxvdywgU3RlcERhdGEgfSBmcm9tICcuLi90eXBlcy9mbG93JztcblxuaW50ZXJmYWNlIEhpc3RvcnlTdGF0ZSB7XG4gIGZsb3c6IEZsb3c7XG4gIHRpbWVzdGFtcDogbnVtYmVyO1xufVxuXG5pbnRlcmZhY2UgRmxvd0NvbnRleHRUeXBlIHtcbiAgZmxvdzogRmxvdztcbiAgYWRkU3RlcDogKHN0ZXA6IFN0ZXBEYXRhKSA9PiB2b2lkO1xuICB1cGRhdGVTdGVwOiAoaWQ6IHN0cmluZywgY2hhbmdlczogUGFydGlhbDxTdGVwRGF0YT4pID0+IHZvaWQ7XG4gIGRlbGV0ZVN0ZXA6IChpZDogc3RyaW5nKSA9PiB2b2lkO1xuICBnZXRTdGVwOiAoaWQ6IHN0cmluZykgPT4gU3RlcERhdGEgfCB1bmRlZmluZWQ7XG4gIGdldEFsbFN0ZXBzOiAoKSA9PiBTdGVwRGF0YVtdO1xuICBpbXBvcnRGbG93OiAoanNvbjogc3RyaW5nKSA9PiB2b2lkO1xuICBleHBvcnRGbG93OiAoKSA9PiBzdHJpbmc7XG4gIHVwZGF0ZU1ldGFkYXRhOiAoY2hhbmdlczogUGFydGlhbDxGbG93WydtZXRhZGF0YSddPikgPT4gdm9pZDtcbiAgdXBkYXRlQ29uZmlndXJhdGlvbjogKGNoYW5nZXM6IFBhcnRpYWw8Rmxvd1snY29uZmlndXJhdGlvbiddPikgPT4gdm9pZDtcbiAgdXBkYXRlSW50ZWdyYXRpb25zOiAoY2hhbmdlczogUGFydGlhbDxGbG93WydpbnRlZ3JhdGlvbnMnXT4pID0+IHZvaWQ7XG4gIHVuZG86ICgpID0+IHZvaWQ7XG4gIHJlZG86ICgpID0+IHZvaWQ7XG4gIGNhblVuZG86IGJvb2xlYW47XG4gIGNhblJlZG86IGJvb2xlYW47XG4gIGNyZWF0ZU5ld0Zsb3c6ICgpID0+IHZvaWQ7XG59XG5cbmNvbnN0IEZsb3dDb250ZXh0ID0gY3JlYXRlQ29udGV4dDxGbG93Q29udGV4dFR5cGUgfCB1bmRlZmluZWQ+KHVuZGVmaW5lZCk7XG5cbmV4cG9ydCBjb25zdCBGbG93UHJvdmlkZXI6IFJlYWN0LkZDPHsgY2hpbGRyZW46IFJlYWN0LlJlYWN0Tm9kZSB9PiA9ICh7IGNoaWxkcmVuIH0pID0+IHtcbiAgY29uc3QgW2Zsb3csIHNldEZsb3ddID0gdXNlU3RhdGU8Rmxvdz4oe1xuICAgIG1ldGFkYXRhOiB7XG4gICAgICBjb21wYW55X25hbWU6ICcnLFxuICAgICAgdmVyc2lvbjogJzEuMC4wJyxcbiAgICAgIGxhc3RfdXBkYXRlZDogbmV3IERhdGUoKS50b0lTT1N0cmluZygpLFxuICAgIH0sXG4gICAgY29uZmlndXJhdGlvbjoge1xuICAgICAgcnVsZXM6IHt9LFxuICAgICAgY2xpZW50X21hbmFnZW1lbnQ6IHt9LFxuICAgIH0sXG4gICAgc3RhcnQ6ICcnLFxuICAgIHN0ZXBzOiB7fSxcbiAgfSk7XG5cbiAgY29uc3QgW2hpc3RvcnksIHNldEhpc3RvcnldID0gdXNlU3RhdGU8SGlzdG9yeVN0YXRlW10+KFtcbiAgICB7IGZsb3csIHRpbWVzdGFtcDogRGF0ZS5ub3coKSB9LFxuICBdKTtcbiAgY29uc3QgW2N1cnJlbnRIaXN0b3J5SW5kZXgsIHNldEN1cnJlbnRIaXN0b3J5SW5kZXhdID0gdXNlU3RhdGUoMCk7XG5cbiAgY29uc3QgcHVzaEhpc3RvcnkgPSB1c2VDYWxsYmFjaygobmV3RmxvdzogRmxvdykgPT4ge1xuICAgIGNvbnN0IG5ld0hpc3RvcnkgPSBoaXN0b3J5LnNsaWNlKDAsIGN1cnJlbnRIaXN0b3J5SW5kZXggKyAxKTtcbiAgICBuZXdIaXN0b3J5LnB1c2goe1xuICAgICAgZmxvdzogSlNPTi5wYXJzZShKU09OLnN0cmluZ2lmeShuZXdGbG93KSksIC8vIERlZXAgY2xvbmVcbiAgICAgIHRpbWVzdGFtcDogRGF0ZS5ub3coKSxcbiAgICB9KTtcbiAgICBcbiAgICAvLyBLZWVwIG9ubHkgbGFzdCA1MCBzdGF0ZXMgdG8gcHJldmVudCBtZW1vcnkgaXNzdWVzXG4gICAgaWYgKG5ld0hpc3RvcnkubGVuZ3RoID4gNTApIHtcbiAgICAgIG5ld0hpc3Rvcnkuc2hpZnQoKTtcbiAgICB9XG4gICAgXG4gICAgc2V0SGlzdG9yeShuZXdIaXN0b3J5KTtcbiAgICBzZXRDdXJyZW50SGlzdG9yeUluZGV4KG5ld0hpc3RvcnkubGVuZ3RoIC0gMSk7XG4gIH0sIFtoaXN0b3J5LCBjdXJyZW50SGlzdG9yeUluZGV4XSk7XG5cbiAgY29uc3QgdXBkYXRlRmxvdyA9IHVzZUNhbGxiYWNrKChuZXdGbG93OiBGbG93KSA9PiB7XG4gICAgc2V0RmxvdyhuZXdGbG93KTtcbiAgICBwdXNoSGlzdG9yeShuZXdGbG93KTtcbiAgfSwgW3B1c2hIaXN0b3J5XSk7XG5cbiAgY29uc3QgYWRkU3RlcCA9IHVzZUNhbGxiYWNrKChzdGVwOiBTdGVwRGF0YSkgPT4ge1xuICAgIGNvbnN0IG5ld0Zsb3cgPSB7XG4gICAgICAuLi5mbG93LFxuICAgICAgc3RlcHM6IHtcbiAgICAgICAgLi4uZmxvdy5zdGVwcyxcbiAgICAgICAgW3N0ZXAuaWRdOiBzdGVwLFxuICAgICAgfSxcbiAgICB9O1xuICAgIGlmICghZmxvdy5zdGFydCkge1xuICAgICAgbmV3Rmxvdy5zdGFydCA9IHN0ZXAuaWQ7XG4gICAgfVxuICAgIHVwZGF0ZUZsb3cobmV3Rmxvdyk7XG4gIH0sIFtmbG93LCB1cGRhdGVGbG93XSk7XG5cbiAgY29uc3QgdXBkYXRlU3RlcCA9IHVzZUNhbGxiYWNrKChpZDogc3RyaW5nLCBjaGFuZ2VzOiBQYXJ0aWFsPFN0ZXBEYXRhPikgPT4ge1xuICAgIGlmICghZmxvdy5zdGVwc1tpZF0pIHJldHVybjtcbiAgICBjb25zdCBuZXdGbG93ID0ge1xuICAgICAgLi4uZmxvdyxcbiAgICAgIHN0ZXBzOiB7XG4gICAgICAgIC4uLmZsb3cuc3RlcHMsXG4gICAgICAgIFtpZF06IHtcbiAgICAgICAgICAuLi5mbG93LnN0ZXBzW2lkXSxcbiAgICAgICAgICAuLi5jaGFuZ2VzLFxuICAgICAgICB9LFxuICAgICAgfSxcbiAgICB9O1xuICAgIHVwZGF0ZUZsb3cobmV3Rmxvdyk7XG4gIH0sIFtmbG93LCB1cGRhdGVGbG93XSk7XG5cbiAgY29uc3QgZGVsZXRlU3RlcCA9IHVzZUNhbGxiYWNrKChpZDogc3RyaW5nKSA9PiB7XG4gICAgaWYgKCFmbG93LnN0ZXBzW2lkXSkgcmV0dXJuO1xuICAgIGNvbnN0IG5ld1N0ZXBzID0geyAuLi5mbG93LnN0ZXBzIH07XG4gICAgZGVsZXRlIG5ld1N0ZXBzW2lkXTtcbiAgICBcbiAgICAvLyBVcGRhdGUgYW55IHJlZmVyZW5jZXMgdG8gdGhpcyBzdGVwXG4gICAgT2JqZWN0LnZhbHVlcyhuZXdTdGVwcykuZm9yRWFjaChzdGVwID0+IHtcbiAgICAgIGlmIChzdGVwLm5leHQgPT09IGlkKSB7XG4gICAgICAgIHN0ZXAubmV4dCA9IHVuZGVmaW5lZDtcbiAgICAgIH1cbiAgICAgIGlmIChzdGVwLmJyYW5jaGVzKSB7XG4gICAgICAgIE9iamVjdC5lbnRyaWVzKHN0ZXAuYnJhbmNoZXMpLmZvckVhY2goKFtrZXksIHZhbHVlXSkgPT4ge1xuICAgICAgICAgIGlmICh2YWx1ZSA9PT0gaWQpIHtcbiAgICAgICAgICAgIGRlbGV0ZSBzdGVwLmJyYW5jaGVzIVtrZXldO1xuICAgICAgICAgIH1cbiAgICAgICAgfSk7XG4gICAgICB9XG4gICAgfSk7XG4gICAgXG4gICAgY29uc3QgbmV3RmxvdyA9IHtcbiAgICAgIC4uLmZsb3csXG4gICAgICBzdGVwczogbmV3U3RlcHMsXG4gICAgICBzdGFydDogZmxvdy5zdGFydCA9PT0gaWQgPyBPYmplY3Qua2V5cyhuZXdTdGVwcylbMF0gfHwgJycgOiBmbG93LnN0YXJ0LFxuICAgIH07XG4gICAgdXBkYXRlRmxvdyhuZXdGbG93KTtcbiAgfSwgW2Zsb3csIHVwZGF0ZUZsb3ddKTtcblxuICBjb25zdCBnZXRTdGVwID0gdXNlQ2FsbGJhY2soKGlkOiBzdHJpbmcpID0+IGZsb3cuc3RlcHNbaWRdLCBbZmxvd10pO1xuXG4gIGNvbnN0IGdldEFsbFN0ZXBzID0gdXNlQ2FsbGJhY2soKCkgPT4gT2JqZWN0LnZhbHVlcyhmbG93LnN0ZXBzKSwgW2Zsb3ddKTtcblxuICBjb25zdCBpbXBvcnRGbG93ID0gdXNlQ2FsbGJhY2soKGpzb246IHN0cmluZykgPT4ge1xuICAgIHRyeSB7XG4gICAgICBjb25zdCBuZXdGbG93ID0gSlNPTi5wYXJzZShqc29uKTtcbiAgICAgIC8vIFZhbGlkYXRlIGZsb3cgc3RydWN0dXJlIGhlcmVcbiAgICAgIHVwZGF0ZUZsb3cobmV3Rmxvdyk7XG4gICAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICAgIGNvbnNvbGUuZXJyb3IoJ0Vycm9yIGltcG9ydGluZyBmbG93OicsIGVycm9yKTtcbiAgICAgIHRocm93IG5ldyBFcnJvcignSW52YWxpZCBmbG93IEpTT04nKTtcbiAgICB9XG4gIH0sIFt1cGRhdGVGbG93XSk7XG5cbiAgY29uc3QgZXhwb3J0RmxvdyA9IHVzZUNhbGxiYWNrKCgpID0+IHtcbiAgICByZXR1cm4gSlNPTi5zdHJpbmdpZnkoZmxvdywgbnVsbCwgMik7XG4gIH0sIFtmbG93XSk7XG5cbiAgY29uc3QgdXBkYXRlTWV0YWRhdGEgPSB1c2VDYWxsYmFjaygoY2hhbmdlczogUGFydGlhbDxGbG93WydtZXRhZGF0YSddPikgPT4ge1xuICAgIGNvbnN0IG5ld0Zsb3cgPSB7XG4gICAgICAuLi5mbG93LFxuICAgICAgbWV0YWRhdGE6IHtcbiAgICAgICAgLi4uZmxvdy5tZXRhZGF0YSxcbiAgICAgICAgLi4uY2hhbmdlcyxcbiAgICAgICAgbGFzdF91cGRhdGVkOiBuZXcgRGF0ZSgpLnRvSVNPU3RyaW5nKCksXG4gICAgICB9LFxuICAgIH07XG4gICAgdXBkYXRlRmxvdyhuZXdGbG93KTtcbiAgfSwgW2Zsb3csIHVwZGF0ZUZsb3ddKTtcblxuICBjb25zdCB1cGRhdGVDb25maWd1cmF0aW9uID0gdXNlQ2FsbGJhY2soKGNoYW5nZXM6IFBhcnRpYWw8Rmxvd1snY29uZmlndXJhdGlvbiddPikgPT4ge1xuICAgIGNvbnN0IG5ld0Zsb3cgPSB7XG4gICAgICAuLi5mbG93LFxuICAgICAgY29uZmlndXJhdGlvbjoge1xuICAgICAgICAuLi5mbG93LmNvbmZpZ3VyYXRpb24sXG4gICAgICAgIC4uLmNoYW5nZXMsXG4gICAgICB9LFxuICAgIH07XG4gICAgdXBkYXRlRmxvdyhuZXdGbG93KTtcbiAgfSwgW2Zsb3csIHVwZGF0ZUZsb3ddKTtcblxuICBjb25zdCB1cGRhdGVJbnRlZ3JhdGlvbnMgPSB1c2VDYWxsYmFjaygoY2hhbmdlczogUGFydGlhbDxGbG93WydpbnRlZ3JhdGlvbnMnXT4pID0+IHtcbiAgICBjb25zdCBuZXdGbG93ID0ge1xuICAgICAgLi4uZmxvdyxcbiAgICAgIGludGVncmF0aW9uczoge1xuICAgICAgICAuLi5mbG93LmludGVncmF0aW9ucyxcbiAgICAgICAgLi4uY2hhbmdlcyxcbiAgICAgIH0sXG4gICAgfTtcbiAgICB1cGRhdGVGbG93KG5ld0Zsb3cpO1xuICB9LCBbZmxvdywgdXBkYXRlRmxvd10pO1xuXG4gIGNvbnN0IHVuZG8gPSB1c2VDYWxsYmFjaygoKSA9PiB7XG4gICAgaWYgKGN1cnJlbnRIaXN0b3J5SW5kZXggPiAwKSB7XG4gICAgICBjb25zdCBuZXdJbmRleCA9IGN1cnJlbnRIaXN0b3J5SW5kZXggLSAxO1xuICAgICAgc2V0Q3VycmVudEhpc3RvcnlJbmRleChuZXdJbmRleCk7XG4gICAgICBzZXRGbG93KGhpc3RvcnlbbmV3SW5kZXhdLmZsb3cpO1xuICAgIH1cbiAgfSwgW2N1cnJlbnRIaXN0b3J5SW5kZXgsIGhpc3RvcnldKTtcblxuICBjb25zdCByZWRvID0gdXNlQ2FsbGJhY2soKCkgPT4ge1xuICAgIGlmIChjdXJyZW50SGlzdG9yeUluZGV4IDwgaGlzdG9yeS5sZW5ndGggLSAxKSB7XG4gICAgICBjb25zdCBuZXdJbmRleCA9IGN1cnJlbnRIaXN0b3J5SW5kZXggKyAxO1xuICAgICAgc2V0Q3VycmVudEhpc3RvcnlJbmRleChuZXdJbmRleCk7XG4gICAgICBzZXRGbG93KGhpc3RvcnlbbmV3SW5kZXhdLmZsb3cpO1xuICAgIH1cbiAgfSwgW2N1cnJlbnRIaXN0b3J5SW5kZXgsIGhpc3RvcnldKTtcblxuICBjb25zdCBjcmVhdGVOZXdGbG93ID0gdXNlQ2FsbGJhY2soKCkgPT4ge1xuICAgIGNvbnN0IG5ld0Zsb3c6IEZsb3cgPSB7XG4gICAgICBtZXRhZGF0YToge1xuICAgICAgICBjb21wYW55X25hbWU6ICcnLFxuICAgICAgICB2ZXJzaW9uOiAnMS4wLjAnLFxuICAgICAgICBsYXN0X3VwZGF0ZWQ6IG5ldyBEYXRlKCkudG9JU09TdHJpbmcoKSxcbiAgICAgIH0sXG4gICAgICBjb25maWd1cmF0aW9uOiB7XG4gICAgICAgIHJ1bGVzOiB7fSxcbiAgICAgICAgY2xpZW50X21hbmFnZW1lbnQ6IHt9LFxuICAgICAgfSxcbiAgICAgIHN0YXJ0OiAnJyxcbiAgICAgIHN0ZXBzOiB7fSxcbiAgICB9O1xuICAgIHVwZGF0ZUZsb3cobmV3Rmxvdyk7XG4gIH0sIFt1cGRhdGVGbG93XSk7XG5cbiAgY29uc3QgdmFsdWUgPSB7XG4gICAgZmxvdyxcbiAgICBhZGRTdGVwLFxuICAgIHVwZGF0ZVN0ZXAsXG4gICAgZGVsZXRlU3RlcCxcbiAgICBnZXRTdGVwLFxuICAgIGdldEFsbFN0ZXBzLFxuICAgIGltcG9ydEZsb3csXG4gICAgZXhwb3J0RmxvdyxcbiAgICB1cGRhdGVNZXRhZGF0YSxcbiAgICB1cGRhdGVDb25maWd1cmF0aW9uLFxuICAgIHVwZGF0ZUludGVncmF0aW9ucyxcbiAgICB1bmRvLFxuICAgIHJlZG8sXG4gICAgY2FuVW5kbzogY3VycmVudEhpc3RvcnlJbmRleCA+IDAsXG4gICAgY2FuUmVkbzogY3VycmVudEhpc3RvcnlJbmRleCA8IGhpc3RvcnkubGVuZ3RoIC0gMSxcbiAgICBjcmVhdGVOZXdGbG93LFxuICB9O1xuXG4gIHJldHVybiA8Rmxvd0NvbnRleHQuUHJvdmlkZXIgdmFsdWU9e3ZhbHVlfT57Y2hpbGRyZW59PC9GbG93Q29udGV4dC5Qcm92aWRlcj47XG59O1xuXG5leHBvcnQgY29uc3QgdXNlRmxvdyA9ICgpID0+IHtcbiAgY29uc3QgY29udGV4dCA9IHVzZUNvbnRleHQoRmxvd0NvbnRleHQpO1xuICBpZiAoIWNvbnRleHQpIHtcbiAgICB0aHJvdyBuZXcgRXJyb3IoJ3VzZUZsb3cgbXVzdCBiZSB1c2VkIHdpdGhpbiBhIEZsb3dQcm92aWRlcicpO1xuICB9XG4gIHJldHVybiBjb250ZXh0O1xufTsgIl0sIm5hbWVzIjpbIlJlYWN0IiwiY3JlYXRlQ29udGV4dCIsInVzZUNvbnRleHQiLCJ1c2VTdGF0ZSIsInVzZUNhbGxiYWNrIiwiRmxvd0NvbnRleHQiLCJ1bmRlZmluZWQiLCJGbG93UHJvdmlkZXIiLCJjaGlsZHJlbiIsImZsb3ciLCJzZXRGbG93IiwibWV0YWRhdGEiLCJjb21wYW55X25hbWUiLCJ2ZXJzaW9uIiwibGFzdF91cGRhdGVkIiwiRGF0ZSIsInRvSVNPU3RyaW5nIiwiY29uZmlndXJhdGlvbiIsInJ1bGVzIiwiY2xpZW50X21hbmFnZW1lbnQiLCJzdGFydCIsInN0ZXBzIiwiaGlzdG9yeSIsInNldEhpc3RvcnkiLCJ0aW1lc3RhbXAiLCJub3ciLCJjdXJyZW50SGlzdG9yeUluZGV4Iiwic2V0Q3VycmVudEhpc3RvcnlJbmRleCIsInB1c2hIaXN0b3J5IiwibmV3RmxvdyIsIm5ld0hpc3RvcnkiLCJzbGljZSIsInB1c2giLCJKU09OIiwicGFyc2UiLCJzdHJpbmdpZnkiLCJsZW5ndGgiLCJzaGlmdCIsInVwZGF0ZUZsb3ciLCJhZGRTdGVwIiwic3RlcCIsImlkIiwidXBkYXRlU3RlcCIsImNoYW5nZXMiLCJkZWxldGVTdGVwIiwibmV3U3RlcHMiLCJPYmplY3QiLCJ2YWx1ZXMiLCJmb3JFYWNoIiwibmV4dCIsImJyYW5jaGVzIiwiZW50cmllcyIsImtleSIsInZhbHVlIiwia2V5cyIsImdldFN0ZXAiLCJnZXRBbGxTdGVwcyIsImltcG9ydEZsb3ciLCJqc29uIiwiZXJyb3IiLCJjb25zb2xlIiwiRXJyb3IiLCJleHBvcnRGbG93IiwidXBkYXRlTWV0YWRhdGEiLCJ1cGRhdGVDb25maWd1cmF0aW9uIiwidXBkYXRlSW50ZWdyYXRpb25zIiwiaW50ZWdyYXRpb25zIiwidW5kbyIsIm5ld0luZGV4IiwicmVkbyIsImNyZWF0ZU5ld0Zsb3ciLCJjYW5VbmRvIiwiY2FuUmVkbyIsIlByb3ZpZGVyIiwidXNlRmxvdyIsImNvbnRleHQiXSwic291cmNlUm9vdCI6IiJ9\n//# sourceURL=webpack-internal:///./src/context/FlowContext.tsx\n");

/***/ }),

/***/ "./src/pages/_app.tsx":
/*!****************************!*\
  !*** ./src/pages/_app.tsx ***!
  \****************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

eval("__webpack_require__.r(__webpack_exports__);\n/* harmony export */ __webpack_require__.d(__webpack_exports__, {\n/* harmony export */   \"default\": () => (__WEBPACK_DEFAULT_EXPORT__)\n/* harmony export */ });\n/* harmony import */ var react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! react/jsx-dev-runtime */ \"react/jsx-dev-runtime\");\n/* harmony import */ var react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_0__);\n/* harmony import */ var _emotion_react__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! @emotion/react */ \"@emotion/react\");\n/* harmony import */ var _emotion_react__WEBPACK_IMPORTED_MODULE_1___default = /*#__PURE__*/__webpack_require__.n(_emotion_react__WEBPACK_IMPORTED_MODULE_1__);\n/* harmony import */ var _emotion_cache__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! @emotion/cache */ \"@emotion/cache\");\n/* harmony import */ var _emotion_cache__WEBPACK_IMPORTED_MODULE_2___default = /*#__PURE__*/__webpack_require__.n(_emotion_cache__WEBPACK_IMPORTED_MODULE_2__);\n/* harmony import */ var _mui_material_styles__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! @mui/material/styles */ \"./node_modules/@mui/material/node/styles/index.js\");\n/* harmony import */ var _mui_material_styles__WEBPACK_IMPORTED_MODULE_6___default = /*#__PURE__*/__webpack_require__.n(_mui_material_styles__WEBPACK_IMPORTED_MODULE_6__);\n/* harmony import */ var _mui_material_CssBaseline__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! @mui/material/CssBaseline */ \"./node_modules/@mui/material/node/CssBaseline/index.js\");\n/* harmony import */ var stylis_plugin_rtl__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! stylis-plugin-rtl */ \"stylis-plugin-rtl\");\n/* harmony import */ var stylis_plugin_rtl__WEBPACK_IMPORTED_MODULE_3___default = /*#__PURE__*/__webpack_require__.n(stylis_plugin_rtl__WEBPACK_IMPORTED_MODULE_3__);\n/* harmony import */ var stylis__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! stylis */ \"stylis\");\n/* harmony import */ var stylis__WEBPACK_IMPORTED_MODULE_4___default = /*#__PURE__*/__webpack_require__.n(stylis__WEBPACK_IMPORTED_MODULE_4__);\n/* harmony import */ var _context_FlowContext__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! ../context/FlowContext */ \"./src/context/FlowContext.tsx\");\n/* __next_internal_client_entry_do_not_use__ default auto */ \n\n\n\n\n\n\n\n\n// Create RTL cache\nconst cacheRtl = _emotion_cache__WEBPACK_IMPORTED_MODULE_2___default()({\n    key: \"muirtl\",\n    stylisPlugins: [\n        stylis__WEBPACK_IMPORTED_MODULE_4__.prefixer,\n        (stylis_plugin_rtl__WEBPACK_IMPORTED_MODULE_3___default())\n    ]\n});\n// Create theme\nconst theme = (0,_mui_material_styles__WEBPACK_IMPORTED_MODULE_6__.createTheme)({\n    direction: \"rtl\",\n    typography: {\n        fontFamily: \"Rubik, Arial, sans-serif\"\n    },\n    palette: {\n        primary: {\n            main: \"#1976d2\"\n        },\n        secondary: {\n            main: \"#dc004e\"\n        }\n    }\n});\nconst App = ({ Component, pageProps })=>{\n    return /*#__PURE__*/ (0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_0__.jsxDEV)(_emotion_react__WEBPACK_IMPORTED_MODULE_1__.CacheProvider, {\n        value: cacheRtl,\n        children: /*#__PURE__*/ (0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_0__.jsxDEV)(_mui_material_styles__WEBPACK_IMPORTED_MODULE_6__.ThemeProvider, {\n            theme: theme,\n            children: [\n                /*#__PURE__*/ (0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_0__.jsxDEV)(_mui_material_CssBaseline__WEBPACK_IMPORTED_MODULE_7__[\"default\"], {}, void 0, false, {\n                    fileName: \"/Users/omermaoz/whatssapp-bot/flow-editor/src/pages/_app.tsx\",\n                    lineNumber: 40,\n                    columnNumber: 9\n                }, undefined),\n                /*#__PURE__*/ (0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_0__.jsxDEV)(_context_FlowContext__WEBPACK_IMPORTED_MODULE_5__.FlowProvider, {\n                    children: /*#__PURE__*/ (0,react_jsx_dev_runtime__WEBPACK_IMPORTED_MODULE_0__.jsxDEV)(Component, {\n                        ...pageProps\n                    }, void 0, false, {\n                        fileName: \"/Users/omermaoz/whatssapp-bot/flow-editor/src/pages/_app.tsx\",\n                        lineNumber: 42,\n                        columnNumber: 11\n                    }, undefined)\n                }, void 0, false, {\n                    fileName: \"/Users/omermaoz/whatssapp-bot/flow-editor/src/pages/_app.tsx\",\n                    lineNumber: 41,\n                    columnNumber: 9\n                }, undefined)\n            ]\n        }, void 0, true, {\n            fileName: \"/Users/omermaoz/whatssapp-bot/flow-editor/src/pages/_app.tsx\",\n            lineNumber: 39,\n            columnNumber: 7\n        }, undefined)\n    }, void 0, false, {\n        fileName: \"/Users/omermaoz/whatssapp-bot/flow-editor/src/pages/_app.tsx\",\n        lineNumber: 38,\n        columnNumber: 5\n    }, undefined);\n};\n/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (App);\n//# sourceURL=[module]\n//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiLi9zcmMvcGFnZXMvX2FwcC50c3giLCJtYXBwaW5ncyI6Ijs7Ozs7Ozs7Ozs7Ozs7Ozs7OztBQUUrQztBQUNOO0FBQ1k7QUFDRjtBQUNDO0FBQ1Y7QUFDUjtBQUdvQjtBQUV0RCxtQkFBbUI7QUFDbkIsTUFBTVEsV0FBV1AscURBQVdBLENBQUM7SUFDM0JRLEtBQUs7SUFDTEMsZUFBZTtRQUFDSiw0Q0FBUUE7UUFBRUQsMERBQVNBO0tBQUM7QUFDdEM7QUFFQSxlQUFlO0FBQ2YsTUFBTU0sUUFBUVIsaUVBQVdBLENBQUM7SUFDeEJTLFdBQVc7SUFDWEMsWUFBWTtRQUNWQyxZQUFZO0lBQ2Q7SUFDQUMsU0FBUztRQUNQQyxTQUFTO1lBQ1BDLE1BQU07UUFDUjtRQUNBQyxXQUFXO1lBQ1RELE1BQU07UUFDUjtJQUNGO0FBQ0Y7QUFFQSxNQUFNRSxNQUFNLENBQUMsRUFBRUMsU0FBUyxFQUFFQyxTQUFTLEVBQVk7SUFDN0MscUJBQ0UsOERBQUNyQix5REFBYUE7UUFBQ3NCLE9BQU9kO2tCQUNwQiw0RUFBQ04sK0RBQWFBO1lBQUNTLE9BQU9BOzs4QkFDcEIsOERBQUNQLGlFQUFXQTs7Ozs7OEJBQ1osOERBQUNHLDhEQUFZQTs4QkFDWCw0RUFBQ2E7d0JBQVcsR0FBR0MsU0FBUzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7OztBQUtsQztBQUVBLGlFQUFlRixHQUFHQSxFQUFDIiwic291cmNlcyI6WyJ3ZWJwYWNrOi8vZmxvdy1lZGl0b3IvLi9zcmMvcGFnZXMvX2FwcC50c3g/ZjlkNiJdLCJzb3VyY2VzQ29udGVudCI6WyIndXNlIGNsaWVudCc7XG5cbmltcG9ydCB7IENhY2hlUHJvdmlkZXIgfSBmcm9tICdAZW1vdGlvbi9yZWFjdCc7XG5pbXBvcnQgY3JlYXRlQ2FjaGUgZnJvbSAnQGVtb3Rpb24vY2FjaGUnO1xuaW1wb3J0IHsgVGhlbWVQcm92aWRlciB9IGZyb20gJ0BtdWkvbWF0ZXJpYWwvc3R5bGVzJztcbmltcG9ydCB7IGNyZWF0ZVRoZW1lIH0gZnJvbSAnQG11aS9tYXRlcmlhbC9zdHlsZXMnO1xuaW1wb3J0IENzc0Jhc2VsaW5lIGZyb20gJ0BtdWkvbWF0ZXJpYWwvQ3NzQmFzZWxpbmUnO1xuaW1wb3J0IHJ0bFBsdWdpbiBmcm9tICdzdHlsaXMtcGx1Z2luLXJ0bCc7XG5pbXBvcnQgeyBwcmVmaXhlciB9IGZyb20gJ3N0eWxpcyc7XG5pbXBvcnQgeyBBcHBQcm9wcyB9IGZyb20gJ25leHQvYXBwJztcbmltcG9ydCB7IFJlYWN0Tm9kZSB9IGZyb20gJ3JlYWN0JztcbmltcG9ydCB7IEZsb3dQcm92aWRlciB9IGZyb20gJy4uL2NvbnRleHQvRmxvd0NvbnRleHQnO1xuXG4vLyBDcmVhdGUgUlRMIGNhY2hlXG5jb25zdCBjYWNoZVJ0bCA9IGNyZWF0ZUNhY2hlKHtcbiAga2V5OiAnbXVpcnRsJyxcbiAgc3R5bGlzUGx1Z2luczogW3ByZWZpeGVyLCBydGxQbHVnaW5dLFxufSk7XG5cbi8vIENyZWF0ZSB0aGVtZVxuY29uc3QgdGhlbWUgPSBjcmVhdGVUaGVtZSh7XG4gIGRpcmVjdGlvbjogJ3J0bCcsXG4gIHR5cG9ncmFwaHk6IHtcbiAgICBmb250RmFtaWx5OiAnUnViaWssIEFyaWFsLCBzYW5zLXNlcmlmJyxcbiAgfSxcbiAgcGFsZXR0ZToge1xuICAgIHByaW1hcnk6IHtcbiAgICAgIG1haW46ICcjMTk3NmQyJyxcbiAgICB9LFxuICAgIHNlY29uZGFyeToge1xuICAgICAgbWFpbjogJyNkYzAwNGUnLFxuICAgIH0sXG4gIH0sXG59KTtcblxuY29uc3QgQXBwID0gKHsgQ29tcG9uZW50LCBwYWdlUHJvcHMgfTogQXBwUHJvcHMpID0+IHtcbiAgcmV0dXJuIChcbiAgICA8Q2FjaGVQcm92aWRlciB2YWx1ZT17Y2FjaGVSdGx9PlxuICAgICAgPFRoZW1lUHJvdmlkZXIgdGhlbWU9e3RoZW1lfT5cbiAgICAgICAgPENzc0Jhc2VsaW5lIC8+XG4gICAgICAgIDxGbG93UHJvdmlkZXI+XG4gICAgICAgICAgPENvbXBvbmVudCB7Li4ucGFnZVByb3BzfSAvPlxuICAgICAgICA8L0Zsb3dQcm92aWRlcj5cbiAgICAgIDwvVGhlbWVQcm92aWRlcj5cbiAgICA8L0NhY2hlUHJvdmlkZXI+XG4gICk7XG59O1xuXG5leHBvcnQgZGVmYXVsdCBBcHA7ICJdLCJuYW1lcyI6WyJDYWNoZVByb3ZpZGVyIiwiY3JlYXRlQ2FjaGUiLCJUaGVtZVByb3ZpZGVyIiwiY3JlYXRlVGhlbWUiLCJDc3NCYXNlbGluZSIsInJ0bFBsdWdpbiIsInByZWZpeGVyIiwiRmxvd1Byb3ZpZGVyIiwiY2FjaGVSdGwiLCJrZXkiLCJzdHlsaXNQbHVnaW5zIiwidGhlbWUiLCJkaXJlY3Rpb24iLCJ0eXBvZ3JhcGh5IiwiZm9udEZhbWlseSIsInBhbGV0dGUiLCJwcmltYXJ5IiwibWFpbiIsInNlY29uZGFyeSIsIkFwcCIsIkNvbXBvbmVudCIsInBhZ2VQcm9wcyIsInZhbHVlIl0sInNvdXJjZVJvb3QiOiIifQ==\n//# sourceURL=webpack-internal:///./src/pages/_app.tsx\n");

/***/ }),

/***/ "@emotion/cache":
/*!*********************************!*\
  !*** external "@emotion/cache" ***!
  \*********************************/
/***/ ((module) => {

module.exports = require("@emotion/cache");

/***/ }),

/***/ "@emotion/react":
/*!*********************************!*\
  !*** external "@emotion/react" ***!
  \*********************************/
/***/ ((module) => {

module.exports = require("@emotion/react");

/***/ }),

/***/ "@mui/private-theming":
/*!***************************************!*\
  !*** external "@mui/private-theming" ***!
  \***************************************/
/***/ ((module) => {

module.exports = require("@mui/private-theming");

/***/ }),

/***/ "@mui/styled-engine":
/*!*************************************!*\
  !*** external "@mui/styled-engine" ***!
  \*************************************/
/***/ ((module) => {

module.exports = require("@mui/styled-engine");

/***/ }),

/***/ "@mui/utils":
/*!*****************************!*\
  !*** external "@mui/utils" ***!
  \*****************************/
/***/ ((module) => {

module.exports = require("@mui/utils");

/***/ }),

/***/ "@mui/utils/ClassNameGenerator":
/*!************************************************!*\
  !*** external "@mui/utils/ClassNameGenerator" ***!
  \************************************************/
/***/ ((module) => {

module.exports = require("@mui/utils/ClassNameGenerator");

/***/ }),

/***/ "@mui/utils/capitalize":
/*!****************************************!*\
  !*** external "@mui/utils/capitalize" ***!
  \****************************************/
/***/ ((module) => {

module.exports = require("@mui/utils/capitalize");

/***/ }),

/***/ "@mui/utils/clamp":
/*!***********************************!*\
  !*** external "@mui/utils/clamp" ***!
  \***********************************/
/***/ ((module) => {

module.exports = require("@mui/utils/clamp");

/***/ }),

/***/ "@mui/utils/composeClasses":
/*!********************************************!*\
  !*** external "@mui/utils/composeClasses" ***!
  \********************************************/
/***/ ((module) => {

module.exports = require("@mui/utils/composeClasses");

/***/ }),

/***/ "@mui/utils/deepmerge":
/*!***************************************!*\
  !*** external "@mui/utils/deepmerge" ***!
  \***************************************/
/***/ ((module) => {

module.exports = require("@mui/utils/deepmerge");

/***/ }),

/***/ "@mui/utils/exactProp":
/*!***************************************!*\
  !*** external "@mui/utils/exactProp" ***!
  \***************************************/
/***/ ((module) => {

module.exports = require("@mui/utils/exactProp");

/***/ }),

/***/ "@mui/utils/formatMuiErrorMessage":
/*!***************************************************!*\
  !*** external "@mui/utils/formatMuiErrorMessage" ***!
  \***************************************************/
/***/ ((module) => {

module.exports = require("@mui/utils/formatMuiErrorMessage");

/***/ }),

/***/ "@mui/utils/generateUtilityClass":
/*!**************************************************!*\
  !*** external "@mui/utils/generateUtilityClass" ***!
  \**************************************************/
/***/ ((module) => {

module.exports = require("@mui/utils/generateUtilityClass");

/***/ }),

/***/ "@mui/utils/generateUtilityClasses":
/*!****************************************************!*\
  !*** external "@mui/utils/generateUtilityClasses" ***!
  \****************************************************/
/***/ ((module) => {

module.exports = require("@mui/utils/generateUtilityClasses");

/***/ }),

/***/ "@mui/utils/getDisplayName":
/*!********************************************!*\
  !*** external "@mui/utils/getDisplayName" ***!
  \********************************************/
/***/ ((module) => {

module.exports = require("@mui/utils/getDisplayName");

/***/ }),

/***/ "@mui/utils/isMuiElement":
/*!******************************************!*\
  !*** external "@mui/utils/isMuiElement" ***!
  \******************************************/
/***/ ((module) => {

module.exports = require("@mui/utils/isMuiElement");

/***/ }),

/***/ "@mui/utils/resolveProps":
/*!******************************************!*\
  !*** external "@mui/utils/resolveProps" ***!
  \******************************************/
/***/ ((module) => {

module.exports = require("@mui/utils/resolveProps");

/***/ }),

/***/ "@mui/utils/useEnhancedEffect":
/*!***********************************************!*\
  !*** external "@mui/utils/useEnhancedEffect" ***!
  \***********************************************/
/***/ ((module) => {

module.exports = require("@mui/utils/useEnhancedEffect");

/***/ }),

/***/ "clsx":
/*!***********************!*\
  !*** external "clsx" ***!
  \***********************/
/***/ ((module) => {

module.exports = require("clsx");

/***/ }),

/***/ "prop-types":
/*!*****************************!*\
  !*** external "prop-types" ***!
  \*****************************/
/***/ ((module) => {

module.exports = require("prop-types");

/***/ }),

/***/ "react":
/*!************************!*\
  !*** external "react" ***!
  \************************/
/***/ ((module) => {

module.exports = require("react");

/***/ }),

/***/ "react/jsx-dev-runtime":
/*!****************************************!*\
  !*** external "react/jsx-dev-runtime" ***!
  \****************************************/
/***/ ((module) => {

module.exports = require("react/jsx-dev-runtime");

/***/ }),

/***/ "react/jsx-runtime":
/*!************************************!*\
  !*** external "react/jsx-runtime" ***!
  \************************************/
/***/ ((module) => {

module.exports = require("react/jsx-runtime");

/***/ }),

/***/ "stylis":
/*!*************************!*\
  !*** external "stylis" ***!
  \*************************/
/***/ ((module) => {

module.exports = require("stylis");

/***/ }),

/***/ "stylis-plugin-rtl":
/*!************************************!*\
  !*** external "stylis-plugin-rtl" ***!
  \************************************/
/***/ ((module) => {

module.exports = require("stylis-plugin-rtl");

/***/ })

};
;

// load runtime
var __webpack_require__ = require("../webpack-runtime.js");
__webpack_require__.C(exports);
var __webpack_exec__ = (moduleId) => (__webpack_require__(__webpack_require__.s = moduleId))
var __webpack_exports__ = __webpack_require__.X(0, ["vendor-chunks/@mui","vendor-chunks/@babel"], () => (__webpack_exec__("./src/pages/_app.tsx")));
module.exports = __webpack_exports__;

})();
//#region node_modules/.nitro/vite/services/ssr/assets/__23tanstack-start-server-fn-resolver-Dnj9brYC.js
var manifest = {
	"10d7f579db41761858a74b81343dd78df4d60527466a0dff9b7036945e1880f0": {
		functionName: "addWaiver_createServerFn_handler",
		importer: () => import("./_ssr/admin.functions-DgtQLD8u.mjs")
	},
	"15bce7f661ac48a816839ca63b688bf7fa0a68f930ad50521d4f6e75b14bf278": {
		functionName: "saveResident_createServerFn_handler",
		importer: () => import("./_ssr/admin.functions-DgtQLD8u.mjs")
	},
	"18ed183bad5d903c34c30bef00544d8bd5ab23e064459dc8f2aa0493b0774f3f": {
		functionName: "setOpeningBalance_createServerFn_handler",
		importer: () => import("./_ssr/admin.functions-DgtQLD8u.mjs")
	},
	"2d4f69567c75d4d001c321310d9ea9ec962d7d8aa0d9bce74bec46a228b240bf": {
		functionName: "deleteResident_createServerFn_handler",
		importer: () => import("./_ssr/admin.functions-DgtQLD8u.mjs")
	},
	"383c69ebe7c3de2a67cd286820f5fed3f6de5a034af21a6bb758f43874866aa5": {
		functionName: "adminResetPassword_createServerFn_handler",
		importer: () => import("./_ssr/admin.functions-DgtQLD8u.mjs")
	},
	"4e8a61730ca8aa051733bb753bbf9e32e996b0a4565be4259bb20a967274dd25": {
		functionName: "saveNews_createServerFn_handler",
		importer: () => import("./_ssr/admin.functions-DgtQLD8u.mjs")
	},
	"77fe0f3bf5dc0b6a5f9333c92a3c3f320bef805f6f3d2ae3954595fa4d995eba": {
		functionName: "exportYear_createServerFn_handler",
		importer: () => import("./_ssr/admin.functions-DgtQLD8u.mjs")
	},
	"7b7fd3100121a1e97b2aad1f070af332ae38d59002cf3d58e481408328ec750c": {
		functionName: "adminCheck_createServerFn_handler",
		importer: () => import("./_ssr/admin.functions-DgtQLD8u.mjs")
	},
	"7fce1893b006121e3d1cf56ab4a1357b7d7f0d4972e128110c4d9de223aabae3": {
		functionName: "deleteWaiver_createServerFn_handler",
		importer: () => import("./_ssr/admin.functions-DgtQLD8u.mjs")
	},
	"89f029f4fc21ed092423cd54f44fb61078423691288a3a89663a6e0973cd86ea": {
		functionName: "adminLogin_createServerFn_handler",
		importer: () => import("./_ssr/admin.functions-DgtQLD8u.mjs")
	},
	"945ca33df4d1f0b241d8a64192d51032915642480d77c5bc2a1224f4699a8ef6": {
		functionName: "deleteNews_createServerFn_handler",
		importer: () => import("./_ssr/admin.functions-DgtQLD8u.mjs")
	},
	"a262b1fce846378648480e76f216f277701b8d808db0f094e1659b571859cf6c": {
		functionName: "setContributionStatus_createServerFn_handler",
		importer: () => import("./_ssr/admin.functions-DgtQLD8u.mjs")
	},
	"b2abcc3ef5e9f907f51d0611638f8d4f5506625b4a697cdc39d7a602e8fb2659": {
		functionName: "updateContribution_createServerFn_handler",
		importer: () => import("./_ssr/admin.functions-DgtQLD8u.mjs")
	},
	"b778199f0067dc3af0626a35537d9640eabb3a694e5f097e062cd440c74c2c03": {
		functionName: "adminLogout_createServerFn_handler",
		importer: () => import("./_ssr/admin.functions-DgtQLD8u.mjs")
	},
	"c37bab537065b57a06129d0672bf3f70dfa9faa3603d4322e5506344cfffa2e2": {
		functionName: "adminChangePassword_createServerFn_handler",
		importer: () => import("./_ssr/admin.functions-DgtQLD8u.mjs")
	},
	"c4ce8a81ac34866a64f7aad21d55655caa752a5a312bc045d99a0bed0b2e37c5": {
		functionName: "deleteExpense_createServerFn_handler",
		importer: () => import("./_ssr/admin.functions-DgtQLD8u.mjs")
	},
	"c7557fa5e045e428ecd54c571f6c197f03d5d0164a56963dffacb58e5ceeb7ca": {
		functionName: "listContributionsAdmin_createServerFn_handler",
		importer: () => import("./_ssr/admin.functions-DgtQLD8u.mjs")
	},
	"cea92daabf99e4e4bca9ff82dcb338e0e34629f1e03629772ffa755efff8d1c9": {
		functionName: "deleteContribution_createServerFn_handler",
		importer: () => import("./_ssr/admin.functions-DgtQLD8u.mjs")
	},
	"f4ddb009bb2fb0d7a4c611a35df49c25b8ec228cad12572fdbd527f954278655": {
		functionName: "saveExpense_createServerFn_handler",
		importer: () => import("./_ssr/admin.functions-DgtQLD8u.mjs")
	}
};
async function getServerFnById(id, access) {
	const serverFnInfo = manifest[id];
	if (!serverFnInfo) throw new Error("Server function info not found for " + id);
	const fnModule = serverFnInfo.module ?? await serverFnInfo.importer();
	if (!fnModule) throw new Error("Server function module not resolved for " + id);
	const action = fnModule[serverFnInfo.functionName];
	if (!action) throw new Error("Server function module export not resolved for serverFn ID: " + id);
	return action;
}
//#endregion
export { getServerFnById as t };

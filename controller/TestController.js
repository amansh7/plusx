export const g1test1 = async (req, resp) => {
    return resp.json({msg: "This is test 1 under route group 1"});
}
export const g1test2 = async (req, resp) => {
    return resp.json({msg: "This is test 2 under route group 1"});
}

export const g2test1 = async (req, resp) => {
    return resp.json({msg: "This is test 1 under route group 2"});
}
export const g2test2 = async (req, resp) => {
    return resp.json({msg: "This is test 2 under route group 2"});
}

export const g3test1 = async (req, resp) => {
    return resp.json({msg: "This is test 1 under route group 3"});
}
export const g3test2 = async (req, resp) => {
    return resp.json({msg: "This is test 2 under route group 3"});
}
import FrontConf from "../conf";

export interface Account {
    id: number
    username: string
    coins: number
    ownedSkins: Array<string>
}

export interface AuthSession {
    token: string
    account: Account
}

const SESSION_KEY = "doRoyalAuthSession";

export function loadAuthSession() : AuthSession | null {
    const rawSession = localStorage.getItem(SESSION_KEY);
    if (!rawSession) {
        return null;
    }
    try {
        return JSON.parse(rawSession) as AuthSession;
    } catch(e) {
        localStorage.removeItem(SESSION_KEY);
        return null;
    }
}

export function saveAuthSession(session: AuthSession | null) {
    if (session === null) {
        localStorage.removeItem(SESSION_KEY);
        return;
    }
    localStorage.setItem(SESSION_KEY, JSON.stringify(session));
}

export default class AuthApi {
    baseUrl : string

    constructor() {
        const frontConf = new FrontConf();
        this.baseUrl = frontConf.httpApiUrl();
    }

    async register(username: string, password: string) : Promise<AuthSession> {
        return this.authRequest("/auth/register", username, password);
    }

    async login(username: string, password: string) : Promise<AuthSession> {
        return this.authRequest("/auth/login", username, password);
    }

    async me(token: string) : Promise<Account> {
        const response = await fetch(this.baseUrl + "/auth/me", {
            headers: { "Authorization": "Bearer " + token }
        });
        if (!response.ok) {
            throw new Error(await this.errorMessage(response));
        }
        return response.json();
    }

    async updateUsername(token: string, username: string) : Promise<Account> {
        const response = await fetch(this.baseUrl + "/auth/me", {
            method: "PATCH",
            headers: {
                "Authorization": "Bearer " + token,
                "Content-Type": "application/json"
            },
            body: JSON.stringify({ username })
        });
        if (!response.ok) {
            throw new Error(await this.errorMessage(response));
        }
        return response.json();
    }

    async buySkin(token: string, skin: string) : Promise<Account> {
        const response = await fetch(this.baseUrl + "/shop/buy", {
            method: "POST",
            headers: {
                "Authorization": "Bearer " + token,
                "Content-Type": "application/json"
            },
            body: JSON.stringify({ skin })
        });
        if (!response.ok) {
            throw new Error(await this.errorMessage(response));
        }
        return response.json();
    }

    private async authRequest(path: string, username: string, password: string) : Promise<AuthSession> {
        const response = await fetch(this.baseUrl + path, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ username, password })
        });
        if (!response.ok) {
            throw new Error(await this.errorMessage(response));
        }
        return response.json();
    }

    private async errorMessage(response: Response) : Promise<string> {
        try {
            const json = await response.json();
            return json.error || "Erreur serveur";
        } catch(e) {
            return "Erreur serveur";
        }
    }
}

export declare const AuthService: {
    login(loginIdentifier: string, password: string): Promise<{
        accessToken: any;
        refreshToken: any;
        user: {
            id: string;
            role: string;
            vendorId: string | null;
        };
    }>;
    logout(token: string): Promise<void>;
    me(userId: string): Promise<{
        id: string;
        role: string;
        companyId: string;
        vendorId: string | null;
        vendor: {
            id: string;
            name: string;
            code: string;
        } | null;
        permissions: string[];
    }>;
};
//# sourceMappingURL=auth.service.d.ts.map
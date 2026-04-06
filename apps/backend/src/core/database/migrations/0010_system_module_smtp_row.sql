-- Correo de sistema (auth, recuperación, etc.): por defecto usa SMTP del .env (`__USE_ENV__`).
INSERT INTO "module_smtp_settings" (
	"module_slug",
	"smtp_host",
	"smtp_port",
	"mail_secure",
	"smtp_user",
	"smtp_from",
	"smtp_pass_encrypted"
)
VALUES (
	'system',
	'__USE_ENV__',
	587,
	false,
	NULL,
	'noreply@example.com',
	NULL
)
ON CONFLICT ("module_slug") DO NOTHING;

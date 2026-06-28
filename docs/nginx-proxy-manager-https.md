# HTTPS local con Nginx Proxy Manager

La app Prove corre en HTTP interno:

```txt
http://192.168.18.112:3200
```

Para usar la camara desde `prove.local.pe`, el navegador necesita abrir la app por HTTPS.

## Proxy Host

En Nginx Proxy Manager crea o edita el Proxy Host:

```txt
Domain Names: prove.local.pe
Scheme: http
Forward Hostname / IP: 192.168.18.112
Forward Port: 3200
Websockets Support: On
Block Common Exploits: On
```

En la pestana SSL:

```txt
Force SSL: On
HTTP/2 Support: On
```

## Certificado

Si `prove.local.pe` solo existe dentro de tu red local, Let's Encrypt puede no funcionar con HTTP challenge. Tienes dos opciones:

1. Usar un certificado wildcard/publico si controlas DNS de `local.pe`.
2. Crear un certificado local para `prove.local.pe`, cargarlo como Custom Certificate en Nginx Proxy Manager, e instalar/confiar la CA en cada dispositivo que use la camara.

La segunda opcion es la comun en redes internas. Si el certificado no es confiable para el telefono/computadora, la pagina puede abrir con advertencia, pero la camara seguira bloqueada.

## Verificacion

Desde el servidor:

```bash
curl http://127.0.0.1:3200
```

Desde cualquier dispositivo de la red:

```txt
https://prove.local.pe
```

En el navegador debe aparecer candado valido, sin advertencia de certificado.

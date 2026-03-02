# IntiHubs UI Components Guide

Este documento describe los nuevos componentes UI creados para mejorar la experiencia de usuario.

## 🎨 Design System

El archivo `styles/design-system.css` contiene todas las variables CSS del sistema de diseño:

### Colores

```css
/* Primary - Amber (Brand color) */
--color-primary-500: #f59e0b;

/* Semantic Colors */
--color-success-500: #10b981;
--color-warning-500: #f59e0b;
--color-error-500: #ef4444;
--color-info-500: #3b82f6;
```

### Uso

El design system se importa automáticamente en `_app.tsx`. Usa las variables CSS en cualquier componente:

```css
.myButton {
  background-color: var(--color-primary-500);
  border-radius: var(--radius-lg);
  padding: var(--spacing-4);
}
```

---

## 🔔 Toast Notifications

Sistema de notificaciones para feedback al usuario.

### Importación

```tsx
import { useToast } from '../components/ui/Toast';
```

### Uso

```tsx
function MyComponent() {
  const { showSuccess, showError, showWarning, showInfo } = useToast();
  
  const handleSave = async () => {
    try {
      await saveData();
      showSuccess('Guardado exitosamente');
    } catch (error) {
      showError('Error al guardar');
    }
  };
  
  return <button onClick={handleSave}>Guardar</button>;
}
```

### Métodos disponibles

- `showSuccess(message, duration?)` - Toast verde de éxito
- `showError(message, duration?)` - Toast rojo de error  
- `showWarning(message, duration?)` - Toast amarillo de advertencia
- `showInfo(message, duration?)` - Toast azul informativo
- `showToast(message, type, duration?)` - Toast genérico

---

## 💀 Skeleton Loading

Componentes skeleton para estados de carga.

### Importación

```tsx
import { 
  Skeleton, 
  CardSkeleton, 
  StatsCardSkeleton,
  ListItemSkeleton 
} from '../components/ui/Skeleton';
```

### Uso básico

```tsx
// Skeleton básico
<Skeleton variant="text" width="200px" height="20px" />
<Skeleton variant="circular" width={40} height={40} />
<Skeleton variant="rectangular" height={200} />

// Skeletons predefinidos
<CardSkeleton />          // Para cards de cursos
<StatsCardSkeleton />     // Para tarjetas de estadísticas
<ListItemSkeleton />      // Para items de lista
<TableRowSkeleton columns={5} /> // Para filas de tabla
<VideoSkeleton />         // Para reproductor de video
```

### Props

| Prop | Tipo | Default | Descripción |
|------|------|---------|-------------|
| variant | 'text' \| 'circular' \| 'rectangular' \| 'rounded' | 'text' | Forma del skeleton |
| width | string \| number | - | Ancho |
| height | string \| number | - | Alto |
| animation | 'pulse' \| 'wave' \| 'none' | 'wave' | Tipo de animación |

---

## 📭 Empty States

Componentes ilustrados para cuando no hay datos.

### Importación

```tsx
import { EmptyState } from '../components/ui/EmptyState';
```

### Uso

```tsx
<EmptyState
  variant="no-courses"
  title="Sin cursos"
  description="No tienes cursos inscritos aún"
  actionLabel="Explorar cursos"
  onAction={() => router.push('/')}
  secondaryActionLabel="Volver"
  onSecondaryAction={() => router.back()}
/>
```

### Variantes disponibles

| Variante | Uso |
|----------|-----|
| `no-data` | Estado genérico sin datos |
| `no-courses` | Sin cursos |
| `no-videos` | Sin videos |
| `no-students` | Sin estudiantes |
| `no-results` | Sin resultados de búsqueda |
| `error` | Error genérico |
| `no-notifications` | Sin notificaciones |
| `no-schools` | Sin escuelas |

---

## 🥖 Breadcrumbs

Navegación por migas de pan.

### Importación

```tsx
import { Breadcrumbs } from '../components/ui/Breadcrumbs';
```

### Uso con items manuales

```tsx
<Breadcrumbs 
  items={[
    { label: 'Cursos', href: '/courses' },
    { label: 'Matemáticas', href: '/courses/math' },
    { label: 'Clase 1' }  // Sin href = página actual
  ]}
/>
```

### Uso automático

```tsx
// Genera breadcrumbs automáticamente desde la URL
<Breadcrumbs />
```

### Props

| Prop | Tipo | Default | Descripción |
|------|------|---------|-------------|
| items | BreadcrumbItem[] | auto-generated | Items del breadcrumb |
| showHome | boolean | true | Mostrar enlace a inicio |
| separator | 'chevron' \| 'slash' \| 'arrow' | 'chevron' | Estilo del separador |

---

## 🎬 Video Player Mejorado

El VideoPlayer ahora incluye:

### Atajos de teclado

| Tecla | Acción |
|-------|--------|
| Espacio / K | Play/Pause |
| ← / J | Retroceder 10s |
| → / L | Avanzar 10s |
| ↑ / ↓ | Subir/Bajar volumen |
| M | Silenciar |
| F | Pantalla completa |
| < / > | Cambiar velocidad |
| 0-9 | Saltar a porcentaje |
| ? | Mostrar atajos |

### Preferencias persistentes

El reproductor guarda en localStorage:
- Volumen
- Velocidad de reproducción
- Estado de silencio

### Nueva prop

```tsx
<VideoPlayer
  classId="123"
  onTimeUpdate={(currentTime, duration) => {
    // Track video progress
    console.log(`${currentTime}/${duration}`);
  }}
/>
```

---

## 📊 Dashboard Mejorado

El nuevo dashboard incluye:

- **Widgets por rol**: Diferentes estadísticas y acciones para admin, profesor y estudiante
- **Quick Actions**: Botones de acceso rápido personalizados por rol
- **Skeleton loading**: Estados de carga elegantes
- **Empty states**: Mensajes claros cuando no hay datos
- **Responsive**: Adaptado a móviles

---

## 🎨 Mejores prácticas

1. **Usa las variables CSS**: Siempre prefiere `var(--color-primary-500)` sobre valores hardcodeados
2. **Consistencia**: Usa los componentes UI en lugar de crear nuevos para casos comunes
3. **Accesibilidad**: Los componentes incluyen `aria-labels` y son navegables con teclado
4. **Loading states**: Siempre muestra un skeleton mientras cargan los datos
5. **Error states**: Usa EmptyState variant="error" para mostrar errores de manera amigable




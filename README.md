# 35p10.Blazor

## Adding the project as a submodule

From the root of the repository that will consume the library:

```bash
git submodule add https://github.com/35P10/35p10.Blazor.git libs/35p10.Blazor
```

This creates the `libs/35p10.Blazor` directory and registers the submodule in `.gitmodules`. Commit both changes:

```bash
git add .gitmodules libs/35p10.Blazor && git commit -m "chore: add 35p10.Blazor submodule"
```

### Referencing the project

Add a `ProjectReference` to your app's `.csproj` pointing at the project inside the submodule:

```xml
<ItemGroup>
  <ProjectReference Include="..\..\libs\35p10.Blazor\src\35p10.Blazor\35p10.Blazor.csproj" />
</ItemGroup>
```

Adjust the relative path to match where your `.csproj` lives. If you use a `.sln`, you can also add the project to the solution:

```bash
dotnet sln add libs/35p10.Blazor/src/35p10.Blazor/35p10.Blazor.csproj
```

Then link the theme from `index.html` / `_Host` / `App.razor`:

```html
<link rel="stylesheet" href="_content/35p10.Blazor/theme.css" />
```

And add the namespace to `_Imports.razor`:

```razor
@using k35p10.Blazor
```

### Library resources

The library includes public resources under `_content/35p10.Blazor/resources/`. For example, to use the included icon as a browser tab icon:

```html
<link rel="icon" type="image/png" href="_content/35p10.Blazor/resources/Lilito.png" />
```

### Cloning a repo that already uses the submodule

```bash
git clone --recurse-submodules <your-repo-url>
```

If you already cloned without submodules:

```bash
git submodule update --init --recursive
```

### Updating to the latest version

```bash
git submodule update --remote libs/35p10.Blazor
```

Then commit the new pointer:

```bash
git add libs/35p10.Blazor && git commit -m "chore: bump 35p10.Blazor submodule"
```

### Removing the submodule

```bash
git submodule deinit -f libs/35p10.Blazor
git rm -f libs/35p10.Blazor
rm -rf .git/modules/libs/35p10.Blazor
```

## Demo

The `demo/` project shows every component in use:

```bash
dotnet run --project demo/35p10.Blazor.Demo
```

## Typed drag and drop

`KDragDropContext<TValue>` coordinates reusable draggable values and drop zones without knowing the
application's domain. Use `KDraggable<TValue>` for cards and list items,
`KDraggableTableRow<TValue>` inside tables, and `KDropZone<TValue>` for each destination:

```razor
<KDragDropContext TValue="Guid">
    <KDraggable TValue="Guid" Value="item.Id">@item.Name</KDraggable>
    <KDropZone TValue="Guid" OnDrop="id => AddAsync(folder.Id, id)">
        @folder.Name
    </KDropZone>
</KDragDropContext>
```

The context owns the active value and destination, supplies visual drag states, prevents duplicate
drop handling, and exposes optional `DragStarted` and `DragEnded` callbacks. The application remains
responsible only for the operation performed by `OnDrop`.

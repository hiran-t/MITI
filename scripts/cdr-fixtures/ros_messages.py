"""Serializes sample messages with ROS 2 itself, for scripts/cdr-fixtures/generate.js.

    python3 ros_messages.py samples.json > out.json   (in a ROS 2 environment)

Reads [{"key", "type", "message"}], and writes {key: {"schema", "cdr"}}: the type's definition as
miti_bridge advertises it, and the message serialized by the RMW that RMW_IMPLEMENTATION selects,
in hex. Values tagged {"$number": "NaN"} or {"$bigint": "123"} stand for what JSON cannot hold.
"""

import json
import sys

from ament_index_python.packages import get_package_share_directory
from rclpy.serialization import serialize_message
from rosidl_runtime_py.utilities import get_message, get_service

SEPARATOR = '\n' + '=' * 80 + '\n'
PRIMITIVES = {
    'bool', 'byte', 'char', 'float32', 'float64', 'int8', 'uint8', 'int16', 'uint16', 'int32',
    'uint32', 'int64', 'uint64', 'string', 'wstring',
}
NUMBERS = {'NaN': float('nan'), 'Infinity': float('inf'), '-Infinity': float('-inf'), '-0': -0.0}


def read_interface(package, kind, name):
    with open(f'{get_package_share_directory(package)}/{kind}/{name}.{kind}') as file:
        return file.read()


def used_types(text, package):
    """The message types a definition's fields use, as package/Type, in order."""
    types = []
    for line in text.splitlines():
        line = line.strip()
        if not line or line.startswith('#'):
            continue
        type_ = line.split()[0].split('[')[0].split('<=')[0]
        if type_ in PRIMITIVES:
            continue
        parts = type_.split('/')
        types.append(f'{package}/{type_}' if len(parts) == 1 else f'{parts[0]}/{parts[-1]}')
    return types


def with_dependencies(text, package):
    """The definition followed by those of the types it uses, as miti_bridge writes it."""
    out = text.strip()
    seen = set()

    def visit(definition, owner):
        nonlocal out
        for type_ in used_types(definition, owner):
            if type_ in seen:
                continue
            seen.add(type_)
            dependency_package, name = type_.split('/')
            dependency = read_interface(dependency_package, 'msg', name)
            out += SEPARATOR + 'MSG: ' + type_ + '\n' + dependency.strip()
            visit(dependency, dependency_package)

    visit(text, package)
    return out


def schema_and_class(type_):
    package, kind, name = type_.split('/')
    if kind == 'srv':
        service, part = name.rsplit('_', 1)
        request, response = read_interface(package, 'srv', service).split('\n---')
        cls = getattr(get_service(f'{package}/srv/{service}'), part)
        return with_dependencies(request if part == 'Request' else response, package), cls
    return with_dependencies(read_interface(package, 'msg', name), package), get_message(type_)


def value_of(value, type_):
    if isinstance(value, dict) and '$number' in value:
        value = NUMBERS[value['$number']]
    elif isinstance(value, dict) and '$bigint' in value:
        value = int(value['$bigint'])
    return float(value) if type_ in ('float', 'double') else value


def element_type(type_):
    if type_.startswith('sequence<'):
        return type_[len('sequence<'):-1].split(',')[0]
    return type_.split('[')[0]


def fill(message, values):
    types = message.get_fields_and_field_types()
    for name, value in values.items():
        type_ = types[name]
        is_array = type_.startswith('sequence<') or type_.endswith(']')
        item_type = element_type(type_)
        if '/' in item_type:
            cls = get_message(item_type)
            value = [fill(cls(), v) for v in value] if is_array else fill(cls(), value)
        elif item_type == 'octet':
            value = [bytes([v]) for v in value] if is_array else bytes([value])
        else:
            value = [value_of(v, item_type) for v in value] if is_array else value_of(value, item_type)
        setattr(message, name, value)
    return message


def main():
    with open(sys.argv[1]) as file:
        samples = json.load(file)
    out = {}
    for sample in samples:
        schema, cls = schema_and_class(sample['type'])
        message = fill(cls(), sample['message'])
        out[sample['key']] = {'schema': schema, 'cdr': serialize_message(message).hex()}
    json.dump(out, sys.stdout)


if __name__ == '__main__':
    main()
